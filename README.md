# 2x2 Unified Asset + Tool Repair Pipeline

This is a **bulk, cached, pre-launch** compatibility pipeline. It does not edit `site/js/native-test.js`, the browser launcher, client binaries, worker, original maps, or the hand-repaired Crossroads. The only live components it changes are (a) the local numeric-ID asset route in `server/server.mjs` when not already installed, with a backup; and (b) the native place registry **only** with `--activate`, with a backup.

### Included components

- A GitHub-tree-verified download from `Novetus/novetus-assetdelivery` for **all locally missing IDs** with matched files. Asset bytes are checked against the Git blob SHA before entering staging. Supported mesh/texture/audio/model files go to `server/native/asset-library`, scripts to `server/native/asset-recovery/scripts`, and unrecognized files to quarantine. Reuses local files and caches. The user-provided asset report previously identified **973 matching unique IDs**; availability may change.
- `server/lib/asset-resolver.mjs` and an idempotent installer for `/api/asset?id=NUMBER`, including local extracted scene assets. Only local numeric files can be served; not an arbitrary external proxy.
- BakonBot-inspired XML conversion into `server/native/maps/2x2-compat/`, plus asset property URL localization for `https://2x2.lentanyl.com/api/asset?id=...`. Handles simple class/property downgrades (Terrain/Folder/BrickColor/TextSize). Changes are made **only to generated copies**. Some newer features cannot be downconverted automatically.
- The **Crossroads tool source templates** supplied by the user. `prepare-runtime-place.py` restores empty `Script`, `LocalScript`, and `ModuleScript` Source properties from the **exact numeric LinkedSource** when downloaded, and from known matching Crossroads Tool/Script templates for the seven classic tools. Other scripts remain untouched, including every nonempty Source. Makes another cached copy at `server/native/maps/2x2-runtime-ready/` when it restores any scripts.
- Maps are served via existing native `/native/asset` place endpoint once the registry selects generated copies. The browser receives prepared files with no network retrieval blocking launch. Skybox face `Content` IDs are treated like other texture IDs. This is not a live cloud-proxy service.

### Install

Extract ZIP contents into `C:\RBXBanland` (merge `tools` and `server/lib`; never overwrite your existing `server/server.mjs` with an older copy). Stop Node and Arbiter. Keep your own project backup, especially `server/native/places.json` and `server/native/maps/`.

```powershell
cd C:\RBXBanland
py tools\build-all-2x2.py --root "C:\RBXBanland" --origin "https://2x2.lentanyl.com" --activate
```

This performs the **full available Novetus download**, local cache import, XML conversion, exact script/link repairs, and registry activation in one run. The download could be substantial, depending on files available. Does not use a browser startup preload.

If the server route is already installed, it is skipped. Restart both Node and Arbiter when the bulk build finishes. Existing running servers typically keep the previously loaded native registry until restart.

If you've already recovered assets and just want rebuild/repair:

```powershell
py tools\build-all-2x2.py --root "C:\RBXBanland" --skip-download --activate
```

Review `server/native/asset-recovery/bulk-download-report.json`, `bulk-places-report.json`, `runtime-script-repair.json`. **Do not interpret a downloaded script as proof it will execute:** legacy clients still lack modern engine APIs; only linked/exactly matching empty Source fields are filled. Other remote Lua and runtime dependencies may still fail.

### Rollback

Stop Node and Arbiter. Restore the most recent **pre-pipeline registry backup** from `server/native/asset-recovery/registry-backups/` (there may be multiple backups, one for the XML build and another for script repairs). You can also use the newest backup printed by `bulk-compat.py` but that may only revert the last stage. To undo *all* activation, restore the first `places-*.json` backup from **this run**. If a `server/server.mjs` patch was installed, its backup is under `server/backups/server-before-assets-*.mjs`. Restart services. Generated converted copies and recovered caches can remain; they do not replace original files.

### Other sources

The downloader currently uses the verified public `Novetus/novetus-assetdelivery` repository. It also reuses existing scene assets and local client files via the native loader/cache, where available. The `Novetus_src` project and BakonBot converter are references for conversion behavior, not general numeric-ID asset feeds. The other **1,356 missing IDs** from your earlier report require another authorized source; assets that cannot be fetched are logged, never fabricated. Novetus's archive does not grant blanket rights to republish all its content publicly; review source licenses/permissions before distribution.

The four binary RBXL maps remain out of scope.
