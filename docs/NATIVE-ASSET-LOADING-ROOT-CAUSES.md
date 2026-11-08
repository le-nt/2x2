# 2x2 native asset delivery — routing, archive coverage, and failure diagnosis

## Why assets go missing

An imported map can carry `rbxassetid://<ID>`, classic
`http://www.roblox.com/asset/?id=<ID>` references, and
`rbxasset://../../../shareddata/assets/<ID>` links. Many references are
inside linked models loaded after the initial map; XML rewriting alone will
not cover binary model payloads.

The native engine's `ContentProvider` converts `rbxassetid://` using the
client's configured `BaseUrl`. Its base is set by UniversalClient's
`--baseUrl` argument, which should be `<publicOrigin>/native`.
The native handler's `/native/asset?id=<ID>` route and the website's
`/api/asset?id=<ID>` route use the same server-side resolver.

The resolver looks in:
1. `server/native/asset-library/<ID>.<ext>`
2. `site/data/scenes/assets/assets_<ID>.<ext>`
3. `server/native/asset-recovery/scripts/<ID>.<ext>`
4. Optional `AYA_ASSETS_DIR/<ID>.<ext>` archive
5. `server/native/asset-cache/<ID>`
6. Optional `AYA_ASSET_FALLBACK_URL/asset/?id=<ID>`
7. Roblox Asset Delivery, unless `ROBLOX_ASSET_FETCH=0`

Public anonymous Roblox Asset Delivery requests generally require
authentication since April 2025. A 401 means access was denied, *not* that
the item is deleted. Simply changing to v2 does not bypass authorization.
Do not place Roblox login cookies or credentials in client-side JavaScript,
logs, or public configuration. Use only archives and asset-access services
you are authorized to operate.

## Changes in this patch

- The **native client** redirects numeric references from Roblox's historical
  `/asset` and `/v1|v2/asset` endpoints to its configured native base URL
  at **request time**. It also supports the exact Novetus
  `shareddata/assets/<ID>` relative path. Built-in
  `rbxasset://textures` and other non-numeric local paths are unchanged.
  This addresses references encountered in binary models where XML rewriting
  is not applicable.
- The **server resolver** continues local-first bounded downloads and now
  classifies failure reasons, including `upstream_auth_required`,
  `upstream_not_found`, and `upstream_failed`.
- `ASSET_DEBUG=1` enables per-ID upstream diagnostics in the Node server log.
  Native route 404 JSON responses contain a high-level `reason`; the
  website `/api/asset` also sends `X-2x2-Asset-Reason`.
- The **catalog audit tool** inventories numeric asset IDs it can recognize
  in imported XML maps, reports locally available IDs, and optionally
  populates the asset cache using the existing approved sources.

## Test in the local checkout

```powershell
cd D:\RBXBanland
node --test tests/asset-resolver.test.mjs tests/asset-upstream-errors.test.mjs
node tools/audit-asset-coverage.mjs
```

The audit writes `server/native/asset-audit.json`; inspect `counts`,
`unscanned`, `errors`, and individual `assets[].places`. To attempt
downloading **only assets referenced in imported XML maps**, run:

```powershell
$env:ASSET_DEBUG = "1"
node tools/audit-asset-coverage.mjs --download
```

This can make many external requests and may take time. Respect the
source's terms and rate limits. The resolver limits simultaneous upstream
requests to six, individual downloads to 32 MiB, and download timeouts
to 12 seconds. Keep the generated report and downloaded cache out of Git.

For native-client code changes, **rebuild UniversalClient** from the
engine checkout, then install the new `.js`, `.wasm`, and `.data`
artifacts using the project's tested installation workflow.
Only the native engine C++ change requires an Emscripten rebuild.
Server-only resolver and diagnostics changes require a Node restart.

## How to diagnose a missing mesh or texture

1. Open browser devtools **Network** tab. Filter for `asset`.
2. Note the failing URL, asset ID, response status, MIME type, and whether
   it requests `/native/asset`, `/api/asset`, or an outside host.
3. Test `/api/asset?id=<ID>` while authenticated to your own 2x2 site.
4. Check the Node log with `ASSET_DEBUG=1`. A 401 from Roblox means
   `upstream_auth_required`; 404 can mean unavailable or restricted.
5. If HTTP 200 returns but the mesh remains invisible, inspect format/parser
   compatibility separately: downloading bytes is not equivalent to decoding
   an old mesh. Verify `Content-Type`, length, and the engine parse errors.

## Limits and remaining work

This is a compatibility and observability patch, **not a universal solution**:
- The audit cannot reliably find references embedded in binary RBXL/RBXM
  without a binary parser, and cannot discover dynamically generated IDs.
- Some media were deleted, private, moderated, or never archived. They cannot
  be reconstructed from numeric IDs alone.
- The existing native `/asset` endpoint uses numeric place IDs for map
  loading as well as numeric asset IDs. Very small IDs may collide; solving
  that requires an explicit separate place-loading route, not heuristics.
- A 200 response can still contain unsupported asset formats. Native mesh,
  texture, audio, and animation decoders need separate compatibility tests.
- Verify browser session credentials and public base URL before attributing
  all failures to missing upstream content.

Do not overwrite a modified local engine checkout without reviewing the diff.
Keep an independent backup of a working `site/native-client` build.
