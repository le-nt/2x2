# 2x2 legacy URL and built-in texture routing

## Status

- Project Pizza is **not** an upstream asset download provider in the current resolver. Legacy `projectpizza.net/api/asset?id=<number>` values are recognized only as stale references, rewritten to `/native/content-asset?id=<number>`. No network requests to that dead endpoint are necessary.
- The source-level UniversalClient hook is in `services/engine/App/util/ContentProvider.cpp` (`redirectLegacyAssetToBase`), but **source edits do not update deployed UniversalClient.wasm**. Rebuild and deploy the native client separately, with original WASM/JS/data backed up, before expecting old binary maps to route external URLs correctly.
- The browser's missing `/img/icons/*.png` images are website files, not Roblox Open Cloud assets.
- `GetGroupRank` and `IsInGroup` are intentionally outside this work until group services exist.
- CoreScript `RBXScriptSignal expected, got table` errors are unrelated and unchanged.

## Built-in rbxasset files versus numeric assets

`rbxasset://Textures/SpawnLocation.png` is a path inside a historical Roblox client build, **not** a numeric Roblox asset ID. Open Cloud's asset delivery endpoint cannot infer that ID. The correct default is to use `services/engine/.assets/content/textures` and the archived client content bundle, preserving original filename and case semantics.

A controlled fallback exists for requests reaching `/native/legacy-texture?name=<filename>`:
1. Try `site/native-legacy-assets/textures`.
2. Try `services/engine/.assets/content/textures`.
3. If both are absent, read an **explicit verified ID mapping** from `server/native/legacy-texture-ids.json`. Call the existing archive-first asset resolver, which may fetch via the authorized Roblox Open Cloud key and persist bytes.
4. If no mapping exists, return a missing-file response. No guessed asset IDs, arbitrary filename proxy, or external URL fetching.

The mapping is optional and absent by default. Example *format* only (replace `12345` with a verified ID that really corresponds to the file):

```json
{
  "SpawnLocation.png": "12345"
}
```

This fallback only affects the legacy-texture **HTTP route**. Normal `rbxasset://Textures/...` calls still require a native-client file or additional compiled client fallback. Do not claim those paths are fixed merely because the server route exists.

## Applying to a locally modified Windows checkout

The source branch is not deployed automatically. To install the new server-side route without replacing modified files:

```powershell
cd D:\RBXBanland
Invoke-WebRequest "https://raw.githubusercontent.com/le-nt/2x2/feature/universal-roblox-asset-pipeline/tools/install-legacy-texture-cloud.py" -OutFile "$env:TEMP\install-legacy-texture-cloud.py"
py "$env:TEMP\install-legacy-texture-cloud.py" --root "D:\RBXBanland"
py "$env:TEMP\install-legacy-texture-cloud.py" --root "D:\RBXBanland" --apply
node --test tests/legacy-texture-map.test.mjs
```

The installer backs up modified native.mjs, checks source anchors and syntax, and never touches the WASM, maps, user database, or secrets.

## Native verification steps

1. Build the modified `services/engine` Emscripten target using the checkout's pinned toolchain; back up `site/native-client/UniversalClient.{js,wasm,data}` and its manifest before copying outputs.
2. Test an old map with a stale Project Pizza numeric URL. Ensure browser Network shows `/native/content-asset?id=<number>`, and no connection to `projectpizza.net`.
3. Verify both cache-hit and uncached asset requests, and that the API key is never sent to the browser or CDN.
4. For missing `rbxasset://Textures/...`, check actual on-disk case and packaged content list before assigning IDs.
