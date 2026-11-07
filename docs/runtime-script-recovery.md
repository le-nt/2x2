# Automatic linked-tool script recovery

This branch extends the existing runtime preparer; it does **not** replace the native client, engine, repaired Crossroads, or original Roblox maps.

## Bulk dependency recovery (run once, repeat after importing places)

From the project root on Windows:

```powershell
py tools\recover-linked-lua.py --root "C:\RBXBanland" --workers 4
```

This scans registered XML maps for **exact** `LinkedSource` asset IDs and downloads matching `scripts/<ID>.lua` blobs from `Novetus/novetus-assetdelivery`. Downloads are checked against the GitHub repository tree SHA and stored in `server/native/asset-recovery/scripts`. No Lua is executed on the website server.

The existing all-in-one builder also runs this stage unless `--skip-download` or `--skip-linked-scripts` is set:

```powershell
py tools\build-all-2x2.py --root "C:\RBXBanland" --skip-server-route --skip-conversion
```

That last command runs the existing full asset-recovery stage plus linked scripts and the offline map preparer. It does not activate the generated places.

## Automatic preparation when playing

For each *new game worker* in a non-Crossroads registered place:

1. The server calls `tools/prepare-runtime-place.py --place <classic-id>`.
2. The preparer preserves nonempty embedded sources. For empty ones it first looks up the **exact** locally cached linked Lua ID, then exact Crossroads tool/script templates.
3. If scripts are restored, a copy is written under `server/native/maps/2x2-runtime-ready` and that worker receives the copy through the existing `/native/asset?id=<numeric-place-id>` endpoint.
4. If preparation can't run, times out, or produces no repairs, the original registered map is served instead.

Runtime preparation never changes `server/native/places.json`; current original maps remain the fallback. All place IDs containing `crossroads` are excluded from automatic regeneration, including your already-repaired 2008 Crossroads.

The on-demand step uses `py` on Windows, `python3` elsewhere, or the path given by `RBX_PYTHON`. It has a 30-second bound and runs once per place per Node process. After importing additional Lua files, restart Node to retry previously attempted places.

## What this *doesn't* do

It does not promise that a modern script will run on an old client, restore deleted Tool instances, execute arbitrary linked scripts on Node, or fetch protected Roblox assets. Existing asset IDs are served by the separately implemented local `/api/asset` and `/native/asset` resolvers. Mesh and skybox availability still depends on assets actually present in the local cache.

## Reports

- `server/native/asset-recovery/linked-script-recovery.json` — exact matching Lua IDs, downloads, failures
- `server/native/asset-recovery/runtime-script-repair.json` — script replacements performed in the last preparation
- `server/native/maps/2x2-runtime-ready/<place>.source.json` — origin and digest of generated copy

## Safety

Review ownership/licensing before redistributing recovered assets or scripts. Lua is cached as data and only embedded into compatible generated Roblox place copies, not run as Python or server JavaScript.