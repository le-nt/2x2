# Resume checkpoint — 9 November 2026

Continue PR #18 on `codex/universal-runtime`. Do not restart the foundation. Tested implementation commits: `221bc0ad` (native persistence, long-URL crash, controller loader regression, import lock/deadline) and `d5a4653d` (idle browser receive yield and bounded diagnostics).

## Verified in this session

- Actual RCC DataStore APIs: missing GetAsync returns nil; tables round-trip through Set/Get; IncrementAsync, UpdateAsync and ordered paging persist five expected records.
- GDB located a real save crash in `RBX::vformat`: POSIX vsnprintf consumed the va_list before the heap retry for strings longer than 160 characters. The baseline fails the standalone long-URL regression; fixed native test and RCC persistence pass.
- Crossroads loads and displays the original raised-arm rocket holding pose again. Controller metadata is runtime-only so archived unsupported motor flags keep the baseline deserialization behavior.
- Reason 2 Die (2014) reaches its original menu and two-player lobby. Both real browser players clicked Join/Ready; the original round assigns survivor/zombie teams, clones its map, spawns characters and displays the objective. Browser movement changes both server positions. The original Handgun equips with the holding pose and fires a server-observed Tool.Activated event. Full round completion/combat is not claimed.
- All four supplied newer binary places now import, retain exact source bytes, and publish honest partial dependency reports. Offline retry results are committed under tests/evidence. Many assets remain unavailable.
- Four TC1 audio files resolve locally by original asset ID and exact hash in the isolated stack. Cloud and public Roblox fetching remain enabled alongside local assets.
- 19 native HTTP/persistence/import/seeder regressions pass. 35 provider/VFS/asset integration tests pass, 2 platform skips. The POSIX formatter regression passes. RCCService and UniversalClient release builds pass.

## Supplied references

Original ZIP/Lua/RBXM references and hashes are retained under `references/user-supplied/2026-11-09`; they are not automatically installed as gameplay code. Static extraction executed no supplied scripts. Real RCC API checks show hierarchy methods already exist. Attributes, modern TweenService Create/GetValue, TweenInfo, typeof, table.find and table.clear are missing. The attribute module has a deletion bug (removing one value can discard other attributes); do not install it unchanged. Signal.lua itself depends on missing table.find/clear. Native API comparison and source inventories are in tests/evidence.

## Still open

Intermittent networking is NOT fixed. Crossroads disconnected during sustained testing even with receive yielding; receive-stage counters continued polling empty after datagrams stopped. Do not increase timeouts or claim universal compatibility. Complete actual gameplay tests for Sunset 2018, Mogadishu Transit Christmas, and The ROBLOX Gaming Room, then return to Undead/Killbots/Teapots sustained rounds. Add compatibility based on observed errors, preserving original scripts.

## Preserve and resume the environment

- Windows Git checkout: `D:\2x2-universal-runtime`; original dirty `D:\RBXBanland` is preserved. Production client/maps/databases were not replaced.
- WSL Ubuntu-24.04 engine: `/home/llent/2x2-build/engine`; SDK sibling `emsdk`. RCC target `build/linux-rcc-release/RCCService/RCCService`; browser target `build/emscripten-release/UniversalClient`.
- Isolated stack: `work/browser-validation-v2-20261108`, Node port 18490, Arbiter 18491, SOAP 18500–18520. Other older stacks and production must remain untouched. Current Arbiter log: `arbiter-runtime-only.log`; Node log: `node-with-datastore.log`. Read live WSL logs/SQLite through WSL; Windows reads were sometimes stale while WSL handles remained open.
- Browser test tabs were navigated to about:blank after evidence capture. No user desktop/Edge interaction. Read the computer-use skill and restore CUA documentation before resuming browser control.
- Current backend already runs the new DataStore module in this isolated stack, with a validated rollback under `source-before-native-datastore-v2`. Runtime formatter rollback is `/home/llent/2x2-build/backups/runtime-long-url-format-20261109`.
- Latest formatter browser build completed successfully. Verify/stage it with `work/refresh-v2-client.py`, unique backup label and expected previous WASM hash `f1526f97850da7c6e9196520df80886aea831bbc167254152feb9bb1568b7c6b`; do not touch production. If already staged, use its current manifest as truth.
- VFS config: `work/combined-vfs-config.json`, manifest `combined-asset-inventory-virtual-mounts.json`. Archive roots reference verified original extracted folders. Keep all rollback files.
- Importer killed during old slow seeding left a private stale lock; it was inspected/quarantined only after verifying import processes stopped. New importer releases the lock before seeding, with an interruption regression. WSL offline retry was slow and bounded out; Windows retry completed all four. Do not rerun archived source files blindly or replace IDs with different map bytes.
- Cloud key exists in the user's Windows environment and is passed process-only to WSL; never print, commit, copy into browser configuration, or forward it to CDN URLs. Private staging DBs/configuration/credentials and compiled clients are deliberately not committed.
- At `09180c82`, source CI passed; two Actions workflows failed with zero jobs, not test failures. Recheck latest PR/CI after this checkpoint push. PR remains draft, stacked on #17; no merge or production deploy.

The user clarified they have no working reference client and asked to set RCHIVE aside. Continue autonomously with background tests; do not ask again for a reference client or Truss URL.
