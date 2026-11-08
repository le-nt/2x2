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

For a **self-hosted, trusted AyaEX instance**, configure
`AYA_ASSET_FALLBACK_URL` as the root URL and
`AYA_ASSET_FALLBACK_ACCESS_KEY` as its server-only `ASSET_KEY`.
MercuryCore's `/asset/?id=` checks the `accesskey` header when no browser
session is present. Keep this key in the Node server environment; never
place it in website JavaScript or commit it to Git. The resolver only
accepts HTTPS fallback origins, except loopback HTTP for local testing.
Redirects cannot forward the key to a different origin.

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

## Diagnosed from 2026-11-08 browser console

The browser produced concrete failures:

| Requested reference | Root cause / treatment |
|---|---|
| `https://www.projectpizza.net/api/asset?id=105897927` | The obsolete host is not 2x2's authoritative content service; the browser also reported an engine trust-check failure. Request-time and XML rewrites now point known Project Pizda numeric asset links to `/native/asset?id=105897927`. |
| `rbxasset://../../../shareddata/SBCR/2761723` | Numeric archive path was not covered by the previous `shareddata/assets` rewriting. Redirects to `/native/asset?id=2761723`; 2x2's checked-in library contains `2761723.mesh`. |
| `rbxasset://Textures/SpawnLocation.png` | Archived client case matches Windows but not Emscripten's case-sensitive `/content` filesystem. Built-in texture lookup normalizes the known `Textures/` prefix. |
| `rbxasset://../../../shareddata/textures/BillboardNukesForKids.png` | Non-numeric local archived file; cannot be recovered from Roblox by assuming an asset ID. Native routes only safe basenames through `/native/legacy-texture?name=...` using known checked-in legacy/engine texture directories. If absent, it remains absent. |
| `rbxasset://../../../shareddata/charcustom/faces/ItsGoTime.png` | Native route `/native/content?path=faces/ItsGoTime.png`, with checked-in catalog face fallback if original `clients/shareddata` isn't present. |
| `/native/Game/LuaWebService/HandleSocialRequest.ashx` | Separate unimplemented social/group API; an asset proxy cannot fix it. |
| `/img/icons/home.png` and related | Separate website icon path mismatch; the icon directory mostly contains SVG names rather than these PNG names. |
| WebSocket disconnect after connection accepted | Separate gameplay transport/server life-cycle issue; not evidence of an asset-loader failure. |

## Pre-seed an existing Novetus shareddata directory

If you have the original Novetus `shareddata` folder (or a folder containing
`shareddata/`), run:

```powershell
cd D:\\RBXBanland
node tools/seed-novetus-assets.mjs --source "D:\\Path\\To\\Novetus\\shareddata"
node tools/audit-asset-coverage.mjs
```

The importer adds only existing source bytes to the numeric asset library,
legacy named-texture archive, and local character-customization archive.
It does not overwrite an existing file, invent missing files, or contact
external servers. Review `server/native/asset-seed-report.json` afterward.
Existing imported maps and your database are unchanged. Keep the source
archive backed up. The seeder skips unknown extensionless binary formats
rather than guessing their type.

## Recommended production strategy: seed first, proxy second

1. Run `node tools/audit-asset-coverage.mjs` after importing maps. The report identifies numeric references for the XML files the scanner can inspect.
2. Populate the local asset-library from the source archives you have rights to use, including legacy `shareddata` directories and complete native client content files. Keep original filenames and exact formats.
3. If your trusted AyaEX instance has its asset API enabled, set server-only `AYA_ASSET_FALLBACK_URL` and `AYA_ASSET_FALLBACK_ACCESS_KEY`. This enables the existing on-demand fallback through authorized sources.
4. Use `node tools/audit-asset-coverage.mjs --download` to cache auditable missing numeric IDs before users load those maps.
5. During gameplay, route all supported numeric references to the 2x2 server; it serves the preseeded archive or attempts an authorized bounded fetch and caches success.
6. Never treat authentication denial or an unsupported mesh decoder as proof of a deleted asset.

These changes do not require browser clients to reach the discontinued Project Pizda host. They are **not yet a guarantee of total asset coverage**: maps with binary model references, private/deleted items, missing historical billboard textures and nonstandard file formats remain separate tasks. Build and browser-test the C++ patch before deploying it.


## Complete offline seeding workflow (new)

First import the local Novetus `shareddata` archive, if you have it.
This preserves numeric assets in `assets/` and `SBCR/`, and also copies
historical named textures and character files to their local 2x2 directories.
Existing files are never overwritten:

```powershell
cd D:\RBXBanland
node tools/seed-novetus-assets.mjs --source "D:\Novetus\shareddata"
```

Then run the place-file scanner and recursive seeder:

```powershell
node --test tests/native-asset-seeder.test.mjs tests/asset-resolver.test.mjs tests/asset-upstream-errors.test.mjs
node tools/seed-native-assets.mjs
```

The default mode makes **no external network requests**. It scans
`server/native/places.json`, inspects XML maps and uses the existing
`tools/rbxl_binary_inventory.py` parser for binary RBXL properties and
script source. For every discovered numeric ID it checks local libraries,
copies available original bytes to `server/native/asset-seed/<id>.<ext>`,
then walks available linked models to a depth of four, discovering
additional IDs. It writes:

- `server/native/asset-index.json` — IDs, source game IDs, dependencies,
  SHA-256, sizes, formats, and resolution status.
- `server/native/asset-reports/<game-id>.json` — per-game coverage,
  unresolved IDs, and whether scanning was incomplete.

You can seed just one game without touching other reports:

```powershell
node tools/seed-native-assets.mjs --place 2008m-crossroads
```

To fill missing IDs through configured upstream sources, **explicitly**
enable downloads and set ceilings. For example:

```powershell
$env:AYA_ASSET_FALLBACK_URL = "https://YOUR-TRUSTED-ASSET-SERVICE.example"
$env:AYA_ASSET_FALLBACK_ACCESS_KEY = "YOUR-SERVER-ONLY-ACCESS-KEY"
node tools/seed-native-assets.mjs --download --max-fetch 100 --max-assets 10000 --max-depth 4
```

The access-key example is a placeholder, not a working public service.
Do not commit or expose the secret. The existing resolver also tries
anonymous Roblox Asset Delivery unless `ROBLOX_ASSET_FETCH=0`; in
practice that may return 401. Only run upstream downloads for assets
you are permitted to retrieve. The downloader has per-request byte,
duration, concurrency, and overall-count safeguards. Re-running the
seeder preserves previously archived bytes rather than overwriting them.

Successful runtime proxy responses are now also preserved automatically in
`server/native/asset-seed/` when space is available, independently of the
evictable `asset-cache` directory. Set `ASSET_PERSIST_DOWNLOADS=0` to
turn off runtime archiving or `ASSET_ARCHIVE_MAX_GB=20` (default 20 GiB)
to adjust its storage ceiling. Existing seed files are never intentionally
overwritten. New seed files become visible to the resolver immediately.

The actual client accesses the permanent seeded directory **first**.
For new builds, media IDs go to `/native/content-asset?id=<ID>` and
place IDs continue using `/native/asset?id=<place-id>`, so collisions
between numeric media IDs and numeric place IDs cannot cause the server
to serve an RBXL where a mesh or image is expected. Existing historical
Roblox and Project Pizda content URLs are intercepted by the engine's
`ContentProvider`, not sent directly to dead external hosts. This is a
**native C++ change**, so it is not active until UniversalClient is
rebuilt and its manifest updated. The Node route changes require a
server restart.

Authenticated users can inspect a generated report via
`/api/native/asset-coverage?id=<game-id>`.

### Interpretation and limitations

Do **not** treat the per-game `complete` field as a proof that the game
renders or works offline: it only covers recognized static references.
The binary decoder supports some property types and can report
unsupported properties; Lua code that computes asset IDs at runtime
cannot be completely discovered by static scanning. A delivered file
may still be unreadable by the old client (format incompatibility).
Assets that are private, removed, or absent from accessible archives
cannot be recovered solely from their ID.

This workflow does **not** automatically provision Cloudflare R2 or a
third-party proxy. Those require service credentials, ownership/access
permissions and hosting configuration. Seeded files remain on 2x2's
local disk unless an operator explicitly replicates them to other storage.
