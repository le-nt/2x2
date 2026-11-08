# Universal Roblox asset delivery for 2x2

This is an additive source branch based on `fix/native-asset-routing-and-diagnostics`.
It does **not** replace a locally modified resolver, native client, database, or compiled WebAssembly binary.

## Goals

- Accept newly imported RBXL and RBXLX files, not only historic Roblox maps.
- Scan each imported game and linked model for recognized asset IDs.
- Serve original bytes from a permanent local archive before attempting a network request.
- When configured, attempt **authorized** Roblox Open Cloud asset delivery with a server-only API key.
- Continue to support the existing authorized AyaEX source and legacy fallback.
- Cache successful responses for subsequent browser sessions.

## Configure on the server (when the key is available)

Set `ROBLOX_OPEN_CLOUD_API_KEY` in the **Node server process environment**, never in
the browser, source code, Git history, a public config file, or support logs.
The key must have appropriate Open Cloud legacy asset-delivery permissions, including
`legacy-asset:manage`, and can only read assets it is permitted to access.

Example in a locally administered PowerShell process:

```powershell
$env:ROBLOX_OPEN_CLOUD_API_KEY = Read-Host 'Open Cloud API key'
node server/server.mjs
```

Do not echo that key or paste it into a terminal transcript. Existing cache
and local archives work with no key. `ROBLOX_ASSET_FETCH=0` disables the legacy
anonymous Roblox fallback without disabling Open Cloud.

## Import any new RBXL / RBXLX

```powershell
node tools/import-any-native.mjs --file "D:\\Maps\\my-new-place.rbxl" --id my-new-place --name "My new place" --offline
```

This performs an additive import into `server/native/maps` and `places.json`, then
runs per-game discovery. It refuses conflicting map IDs instead of silently overwriting
existing places. It does not modify `site/data/maps.json`, so website catalog listing
may require a separate entry. The runtime native registry reads `places.json`.

Without `--offline`, the importer attempts up to 100 upstream asset resolutions
**if the Open Cloud API key is configured**. Use `--download --max-fetch 100` to
explicitly allow upstream access with the existing resolver even without Open Cloud.
The server's normal on-demand route can also fetch missing assets during gameplay.

One-game coverage appears in:

- `server/native/asset-reports/my-new-place.json`
- `server/native/asset-index.my-new-place.json`

A one-game scan intentionally does **not** overwrite the global
`server/native/asset-index.json`. To refresh the full catalog index, run:

```powershell
node tools/seed-full-archive.mjs
```

The existing catalog importer `tools/import-native.py` now runs asset discovery
automatically after importing. Add `--skip-asset-seed` to opt out.

## Test

```powershell
node --test tests/roblox-open-cloud.test.mjs tests/native-asset-seeder.test.mjs tests/asset-resolver.test.mjs tests/asset-upstream-errors.test.mjs
```

The Open Cloud tests use mocked network responses. No real API key or network
requests are needed to test source behavior.

## Security and compatibility boundaries

- Fetch keys are server-only. Open Cloud credentials are not sent to redirected
  CDN URLs, browsers, game clients, or arbitrary hosts.
- Redirect destinations are restricted to selected HTTPS Roblox asset hosts.
- Individual assets are capped at 32 MiB; resolver concurrency and request counts
  remain bounded; file archives are persisted independently of the evictable cache.
- An authorization denial is **not** evidence that an asset does not exist.
- The discovery scanner cannot find every dynamic ID or decode every binary
  property. Successful download does not guarantee the old client can parse a
  modern mesh or animation.
- The C++ ContentProvider routing in the underlying asset branch still needs
  a matching Emscripten UniversalClient build and browser verification.
- Local 2x2 checkout changes may conflict with this PR. Review and merge them
  rather than overwriting working locally modified files.
