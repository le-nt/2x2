# 2x2: missing assets and script triage

Status: source changes committed to the development PR. They do not alter a user's running Node server or compiled UniversalClient until installed and rebuilt.

## Why the missing files have different causes

1. Numeric `rbxassetid://<id>` or `/asset?id=<id>` — local archive first, Roblox Open Cloud if permitted; cached on success.
2. `rbxasset://../../../shareddata/RiseOfTheKillbots/fonts/Shotgun.mesh`, `shareddata/Sky/...` — **historical file paths**, not cloud IDs. Runtime C++ now routes these to `/native/legacy-shared?path=...`. The server checks approved local archive roots, including `RBX_LEGACY_SHARED_ROOTS`.
3. `rbxasset://Textures/SpawnLocation.png` — original client-bundled file. The WebAssembly preloaded `/content` filesystem needs that file at build time. Locate original content first; do not guess a Roblox asset ID.
4. `rbxasset://sounds/Rocket whoosh 01.wav` reports FMOD error 68 — **audio backend failure**, not necessarily a missing file; separate FMOD investigation.
5. Browser `/img/icons/*.png` 404 — website static assets, not Roblox Cloud assets.
6. `GetGroupRank` and `IsInGroup` 404 — unimplemented group service; not evidence the script source is absent.
7. `MarketplaceService:getProductInfo()` failure — missing marketplace compatibility API; not equivalent to Lua compilation failure.
8. Game behavior may be broken by a script body missing from the imported map, an unsupported engine API, an incorrectly restored script, or a runtime execution fault. The browser console alone does not identify which of those occurred.

## Install guarded source patches (PowerShell)

```powershell
cd D:\RBXBanland
Invoke-WebRequest "https://raw.githubusercontent.com/le-nt/2x2/feature/universal-roblox-asset-pipeline/tools/install-native-asset-fixes.py" -OutFile "$env:TEMP\install-native-asset-fixes.py"
py "$env:TEMP\install-native-asset-fixes.py" --root "D:\RBXBanland"
py "$env:TEMP\install-native-asset-fixes.py" --root "D:\RBXBanland" --apply
node --test tests/native-asset-prefetch.test.mjs tests/legacy-shared-assets.test.mjs
```

The installer checks source anchors, backs up source edits, does not replace `site/native-client/UniversalClient.*`, and never modifies map/database/credentials.

## Locate missing files without modifying anything

```powershell
py tools\find-legacy-files.py --project D:\RBXBanland
```

If additional historic archive folders exist, append `--root "D:\path\to\archive"` for each. The scan does not follow symlink directories. A match like `D:\OldArchive\shareddata\Sky\redsky512_rt.png` implies the root should be `D:\OldArchive\shareddata`:

```powershell
$env:RBX_LEGACY_SHARED_ROOTS = "D:\OldArchive\shareddata"
```

Set this in the actual Node server environment and restart `start-2x2.bat`. Multiple roots are semicolon-separated on Windows. The server won't recursively scan the entire disk on each request; it resolves safe relative paths under the configured roots.

## Audit the two reported XML maps

```powershell
py tools\audit-native-place-scripts.py --root D:\RBXBanland
```

The audit reports counts of `Script`, `LocalScript`, `ModuleScript`, nonempty vs empty `Source`, disabled scripts, and whether empty scripts have a `LinkedSource` reference. It does not print or execute the Lua code or change files.

The existing `tools/prepare-runtime-place.py` can attempt to restore missing script sources **only** from exact known linked source IDs or verified templates, into generated map copies. It never proves the restored script is compatible with the current engine.

## Rebuilding UniversalClient safely

The existing build lives at `~/2x2-build/engine`, while the user's Windows source lives at `D:\RBXBanland\services\engine`; they are separate source directories. After applying the Windows source patch, copy only the two changed C++ files to the WSL tree after backup, then build:

```bash
set -e
SRC=/mnt/d/RBXBanland/services/engine
DST=$HOME/2x2-build/engine
mkdir -p "$HOME/2x2-client-backup/pre-shared-routing"
cp "$DST/App/util/ContentProvider.cpp" "$HOME/2x2-client-backup/pre-shared-routing/"
cp "$DST/App/util/Emscripten/HttpPlatformImpl.cpp" "$HOME/2x2-client-backup/pre-shared-routing/"
cp "$SRC/App/util/ContentProvider.cpp" "$DST/App/util/ContentProvider.cpp"
cp "$SRC/App/util/Emscripten/HttpPlatformImpl.cpp" "$DST/App/util/Emscripten/HttpPlatformImpl.cpp"
source "$HOME/2x2-build/emsdk/emsdk_env.sh"
cmake --build "$DST/build/emscripten-release" --target UniversalClient -j4
```

Check the exit status and verify new outputs before replacing the live client. Back up `UniversalClient.js`, `.wasm`, `.data` and `manifest.json`; update the manifest only when appropriate for its actual schema. Do not assume this rebuild fixes unrelated Lua scripting or FMOD behavior.
