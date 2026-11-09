# Universal runtime engineering baseline

Work starts from `012a1c8f`, the head of PR #17, stacked on PR #16. The
working checkout at `D:\RBXBanland` has extensive uncommitted changes and is
not the same implementation as that branch. It remains untouched. Engineering
work is isolated on `codex/universal-runtime` at `D:\2x2-universal-runtime`.

## Observed lifecycle

1. `tools/import-native.py` handles catalog imports;
   `tools/import-any-native.mjs` registers new RBXL/RBXLX places.
2. Both invoke `tools/seed-native-assets.mjs`, which uses the existing numeric
   resolver and Open Cloud adapter and traverses nested model dependencies.
3. `server/lib/native.mjs` reads `server/native/places.json`, prepares optional
   runtime copies through `prepare-runtime-place.py`, and asks Arbiter to start
   a worker. Originals are not replaced by preparation.
4. `services/arbiter/src/rcc.rs` starts RCC with server-owned credentials in its
   environment and runs `resources/scripts/GameServer.lua` over SOAP.
5. GameServer disables scripts while configuring services and loading the place,
   starts NetworkServer, re-enables scripts, and starts RunService. Therefore
   scripts being globally left disabled is not established as the failure.
6. The website issues signed player/join/socket tickets. UniversalClient joins
   through the authenticated native WebSocket bridge; instances replicate via
   the native engine, not the site's scene renderer.
7. `ContentProvider::privateLoadContent` routes numeric assets and historical
   URLs. Packaged assets use the client filesystem. Missing packaged content
   needs a general archive fallback; previous routing also rejected spaces.
8. Lua scheduling, compilation and runtime errors are implemented in
   `App/script/ScriptContext.cpp`. `LuaVM::load`, `script->starting`, `resume`,
   and `ScriptContext.Error` provide distinct diagnostic opportunities.

## Implemented foundation

- Versioned directory inventory with SHA-256, original location, archive/root
  identity, client version, relative path, file type, duplicate/conflict records,
  scan limits and explicit diagnostics. Asset IDs are null where unknown.
- Manifest VFS uses trusted root configuration, full relative paths and hashes.
  It refuses conflicting bytes without a known version/hash, checks realpath
  containment, and bounds verification metadata. It does not copy resources.
- Import seeding automatically inventories known client/content/shareddata
  roots. Extra roots can be configured once in `asset-vfs-config.json` or through
  `RBX_ASSET_VFS_CONFIG`. `node tools/inventory-asset-vfs.mjs CONFIG.json` is the
  reproducible standalone scanner. Known roots added later are discovered on
  the next import for automatically generated configurations.
- Authenticated `/native/archive-content?path=...` delivers manifest resources;
  existing shareddata delivery consults the same VFS. Conflicts are HTTP 409,
  integrity failures never fall back to unverified archive bytes.
- Structurally invalid imports fail before registry/map writes; XML entities
  and DTDs are rejected. Script names, paths, disabled state and source hashes
  appear in import analysis. Original bytes remain unchanged.
- Binary scanning now examines every supported string property, including
  custom names. Binary decoding remains explicitly partial; no successful
  string scan is presented as full format compatibility.
- Importer registry mutation is serialized with an exclusive lock. An abandoned
  `.import.lock` requires operator inspection; it is not silently stolen.
- Registry and inventory refresh make newly imported places visible without
  restarting the server. Website catalog/UI upload integration remains separate.

## Measured local baseline (2026-11-08)

Windows clients, shareddata, engine content and legacy site resources were read.
Initial inventory: 7,289 nonempty files, 1,080 duplicate/conflicting relative
paths. Nine empty files were initially reported as size diagnostics; the scanner
now inventories empty files too, while the resolver does not serve them.
Historical HD textures conflict with ordinary textures; choosing the first
filename would silently change original appearance. Packaged content remains
preferred in the native client.

The three reported historical files were found. Shotgun/pistol meshes and the
redsky textures were not located in this inventory. A wider search of explicitly
identified D: backup/archive folders was also run; see session output artifacts.
`map-pack/Novetus-Map-Pack.zip` contains 556 entries and no mesh/image/audio
resource entries. This does not establish that absent files are unrecoverable.

Actual registered XML files:

| Place | Scripts with source | Disabled | Literal numeric IDs | rbxasset references |
|---|---:|---:|---:|---:|
| Undead Coming v1.3 | 30 | 4 | 14 | 16 |
| Killbots / Heights IV | 63 | 8 | 0 | 48 |

Killbots uses a prepared map under `maps/2x2-compat/`, not the presumed top-level
filename. Registration is the source of truth for locating a map.

WSL Ubuntu-24.04 contains the specified engine, emsdk, WebAssembly build and
Linux RCC build. Windows and WSL ContentProvider sources had identical SHA-256
`3ec71e07c44b320f144b37269458fc440e181e2f9b585fc1376ca4c80d9e6feb`.
They did not contain PR #16/#17's latest archive routing code. The deployed
client is a separate artifact and is not overwritten by these changes.

## Verification and remaining work

Offline Windows checks cover VFS identity/conflicts, integrity, traversal,
automatic import, recursive numeric model discovery, structural XML/binary
analysis, native authentication and HTTP delivery, and Crossroads map delivery.
Windows could not create the symlink fixture; Linux verification is required.
The native HTTP test copied all maps on Windows due to slash-specific filtering;
this was corrected using path components. A stale ad-response assertion and
Crossroads assertion were updated to match current API behavior and URL routing.

UniversalClient, Linux RCCService and Arbiter release builds succeeded in WSL.
Only individually hash-checked native source files were installed there, after
source and build-output backups. `tools/install-runtime-vfs-engine.py` reproduces
that guarded installation; it is dry-run by default. The WSL/Windows services
source differences were inspected; one was a trailing newline difference.
The deployed `D:\RBXBanland\site\native-client` was not replaced.

The isolated native fixture verifies that a real enabled Lua Script executes,
a Disabled Script stays stopped, a syntax failure is distinguished from a later
runtime exception, and errors retain script paths/stacks. A lowercased Rocket
WAV reference containing spaces exercised the native archive HTTP fallback and
delivered original SHA-256 `50e9dc73388304c9c35cd47360e0a47287e80ed2d034336170878755d9769898`.
That is delivery evidence, not audio playback evidence.

The probe also demonstrated a startup URL defect: the legacy metadata URL
builder changed `127.0.0.1:<port>/native` into `https://www.0.1:<port>/...`.
RCC now preserves the configured internal server URL. Absent metadata endpoints
remain explicit failures; no security hashes or versions are fabricated.
RCC previously printed its server access key through its sensitive logger;
known access/signing credentials are now redacted while all message classes,
including sensitive connection diagnostics, remain visible. The native fixture
deliberately prints dummy credentials and asserts that only redacted text is
retained.

Ten-second native server observations, without players:

| Place / native ID | Compiled / starting events | Compile failures | Script errors |
|---|---:|---:|---:|
| Undead Coming / 6 | 8 / 8 | 0 | 0 |
| Killbots / 205 | 43 / 43 | 0 | 1 |
| Crossroads / 1 | 26 / 26 | 0 | 0 |
| Teapots / 277 | 44 / 44 | 0 | 0 |

Counts include engine starter scripts and repeated instance paths; they are not
the static script count. LocalScripts in player-owned containers are not expected
to start without a player. Killbots' error is
`Workspace.SFOTHBase.Model.Elevator.Script:11`: the referenced `Levels` child is
absent from the imported XML too. No synthetic Levels object was inserted.

`tools/probe-rcc-runtime.py` reproduces these observations using a disposable
worker, dummy credentials and a fixed loopback place server. Its resource fixture
does not retrieve arbitrary assets or emulate all production endpoints.
`tools/compare-compatibility-reports.mjs BEFORE.json AFTER.json` compares static
dependency reports or native probe reports, flags changed place bytes, and keeps
untested gameplay explicit.

The combined inventory now records **11,151 files across 22 roots**, including
WSL content, numeric asset stores and platform content. There are **2,480 files
with known numeric IDs**, **495 conflicting relative paths** and **1,850 identical
duplicate groups**. The scan completed without truncation or diagnostics.
The WSL content directory contains the Rocket WAV; the Windows content directory
differs. Numeric/platform inventory-only roots are not exposed as arbitrary HTTP
files. The wider filename search inspected 60,457 files in the known D: archives.

The main Linux regression run passed 44 tests; subsequent VFS tests additionally
cover inventory-only roots and invalid configured manifests failing closed.
Windows CI initially exposed an 8.3-alias discrepancy: `realpathSync` preserved
`RUNNER~1` while `promises.realpath` expanded it, so valid files failed the
containment check. The discrepancy was reproduced locally with a real short
archive path, corrected using consistent native canonicalization, and checked
with short-path TMP/TEMP against inventory, ingestion and native HTTP tests.
Nine Python structural/binary tests passed. A broader optional legacy-loader
source check fails on the unchanged PR #17 baseline: it expects an optional
preload implementation that the existing emergency-rollback loader removed.
That existing UI behavior was not rewritten to satisfy the stale assertion.

Browser validation now observes Crossroads world rendering, player movement and
equipping. Two native players in Undead reached the lobby, started the round and
received human/zombie teams. These are partial gameplay observations, not full
compatibility. Weapon distribution then failed because the game's `Zip` scripts
store unparented clones in weak ObjectValues; native observation found all four
template values nil. `App/v8datamodel/Value.cpp` confirms weak-reference storage.
The native ObjectValue fix now retains detached targets only while the keeper
is rooted in the DataModel, with ancestry tracking to release retention when
the target becomes parented or the keeper leaves the game. Self, ancestor and
DataModel references remain weak. A real RCC fixture verifies clone survival
after its creator script is destroyed, reparenting, clearing, and collection
after clear/unroot/ancestor transitions. RCC and UniversalClient release builds
pass. On a fresh worker, native observation finds the original Pistol,
FastZombie, KamiZombie and Zombie templates intact. Sustained two-player rounds
remain blocked by intermittent browser connection loss under investigation.
No replacement weapons or zombie behavior were injected.

Player entry also exposed a missing default Health script. An explicitly
configured, hash-pinned VFS relocation delivered the archived original script
and exposed the unsupported `RBXScriptSignal:Wait()` capitalization. The engine
now dispatches that alias through the existing native wait implementation; the
RCC probe verifies yield/resume with the fired value. See
`ASSET-VFS-MAPPINGS.md` for mapping semantics and remaining ordering tests.

Crossroads browser input now activates original tools and creates native
projectiles attributed to the actual player. Queued SDL mouse edges and fresh
InputObject snapshots prevent short clicks from disappearing before Lua sees
them. Some earlier sessions disconnected at varying intervals; later sessions
exchanged traffic for over 40 minutes. This does not establish every disconnect
cause. Repeated internal path separators also caused a genuine sound 404;
VFS canonicalization now handles these while still rejecting absolute paths
and dot segments.

The missing default tool hold/slash/lunge animations were recovered by their
original IDs through the existing public resolver. Browser screenshots show the
holding pose restored. Import dependency discovery now inspects the native
avatar bootstrap models, so these dependencies are discovered automatically.
Writable validation seeds are independent copies, with isolation regressions;
read-only libraries retain symlinks. Three test-created animation cache files
temporarily reached the original seed through an earlier staging symlink; exact
hash checks allowed their removal and restoration of that seed's prior state.

Killbots runs its original wave UI, NPC movement/shooting, projectiles, explosions
and player death/respawn in the browser. Optional native client lifecycle logs
confirm compilation/start of the original weapon LocalScripts, Animate,
LocalSound, ControlScript and CameraScript. The bundled chat core script still
reports an error; this game is not marked fully compatible.

FMOD 68 was reproduced for the original 545,518-byte Rocket WAV: HTML5 filename
streams fail while memory streams decode and play. Emscripten now streams the
original ContentProvider bytes from a retained, bounded buffer. Both the real
FMOD SDK probe and an observational LocalScript in Killbots show playback time
advancing; for example the same projectile sound advances from 0.280 to 0.774
seconds. The diagnostic never starts sounds or changes gameplay. Desktop file
stream behavior is preserved. Release builds of RCC and UniversalClient pass.

Native worker startup also reproduced an occupied UDP port. Protocol-specific
port reservations now exclude occupied and concurrently reserved ports, and
failed NetworkServer startup reports shutdown instead of advertising readiness.
Four Rust tests and a real RCC occupied-port fixture pass.

Not yet verified: full browser gameplay, all NPCs/weapons,
all replication semantics, all animation/audio assets, R2,
archive-container serving, fully decoded binary values, Lua-aware expression
analysis, and per-game runtime discovery authorization/quotas. No game is marked
gameplay verified. Remaining work continues under the master goal.

Live delivery validation used the existing user-scoped Open Cloud credential
without printing or persisting it. Cloud-only and public-only resolver instances
independently fetched original asset 182393478 (796 bytes), SHA-256
`a2ba69445e813c9ebb2bf8bcf76649aff5ff559f5cf85f8679b3460ffe10a7ed`.
Cloud delivery returned HTTP 200 and followed its signed CDN location without
forwarding the API key. Public delivery followed Roblox's CDN redirect and
returned identical bytes. Both instances then reused their permanent archives
without additional requests. This verifies that asset, not arbitrary private
assets or every permission scope.

## Reference inspection

Repository trees and relevant files were inspected through GitHub, including
Novetus map descriptions and ClientScriptTestForm. No external implementation
was copied for this foundation. License files were read before considering reuse:

- [Project Pizza](https://github.com/lmaobamar/projectpizzacomplete): LICENSE has
  GPLv3 text with a repository-specific introductory condition.
- [Original RBXBanland](https://github.com/colingsnyder2-ux/RBXBanland): no root
  license identified through repository metadata/root listing.
- [Novetus tools](https://github.com/Novetus/Novetus.Tools): custom license text;
  tool-specific attribution must be checked before incorporating source.
- [Novetus source](https://github.com/Novetus/Novetus_src): MIT root license;
  bundled historical assets require separate provenance consideration.
- [Map archive](https://github.com/Novetus/Novetus-Map-Pack): no root license
  identified. Its legacy Killbots directories contain compressed places and
  descriptions, not the requested weapon resource files.
- [AyaEX MercuryCore](https://github.com/AyaEX-PUBLIC/AyaEX-MercuryCore): Unlicense
  root. Existing 2x2 integration is preserved.
- [Novetus distribution](https://bitl.itch.io/novetus) documents separate older
  releases; these releases have not all been downloaded or inventoried.
- The user confirmed Truss has no repository/site to inspect. Its ID-preserving
  archival approach is conceptual guidance; no Truss source inspection is claimed.
