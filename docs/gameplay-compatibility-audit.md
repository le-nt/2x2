# 2x2 gameplay compatibility — scoped repairs

This change set preserves original imported maps, the active place registry, native browser launcher, and existing compiled UniversalClient artifacts. It **does not** rebuild the WebClient or claim that game scripts work in the old engine.

## 1. Gameplay audit (no external dependencies)

After pulling the PR:

```powershell
cd C:\RBXBanland
py tools\build-place-manifests.py --root "C:\RBXBanland"
py tools\audit-gameplay-compat.py --root "C:\RBXBanland" --write
```

This creates:

- `server/native/asset-recovery/compatibility-audit.json`
- `server/native/asset-recovery/compatibility-audit.csv`

The report includes each game's empty embedded script sources, exact missing linked-Lua references, cached vs missing asset IDs, tool `Handle` presence, `RequiresHandle` settings, and instance classes commonly associated with newer places. The report **does not** assert that scripts execute or that tools deal damage.

For a narrower inspection use `--place <registered-id>` with `audit-gameplay-compat.py`. Do not run `--activate` on the old converter as a diagnosis; that changes the registry to generated copies.

## 2. Changes to original engine *source*

In `services/engine/.assets/content/scripts`:

- `StarterScript.lua`: initializes the bundled Chat module regardless of the `UseInGameTopBar` flag, with a warning if loading fails.
- `CoreScripts/HealthScript.lua` and `CoreScripts/Topbar.lua`: replace unavailable image asset `34854607` with a local red tint for damage feedback. The legacy health UI also constructs the GUI before updating it.

**Important:** The live 2x2 site currently uses `site/native-client/UniversalClient.data` and `UniversalClient.wasm` built earlier. Changes to engine source are **not active** just from `git pull`; the native client must be rebuilt with the engine's existing build toolchain, and the resulting *matching* JavaScript/WASM/data bundle must be installed together. Do **not** overwrite the working WebClient with mismatched artifacts. The source changes are committed for the next legitimate native build. Runtime chat also depends on core-script startup, server chat transport and the WebClient build; no live claim is made here. The worker currently calls `SetChatFilterUrl(BaseUrl .. '/Game/ChatFilter.ashx')`, but that endpoint is absent from `server/lib/native.mjs`. An independent legacy chat implementation must include appropriate message moderation before enabling that endpoint; do **not** return unfiltered chat content or a permissive response simply to make messages appear.

## 3. Arbiter transport hardening

The Arbiter's UDP socket for each WebSocket client now binds to `127.0.0.1` rather than all interfaces. This protects ephemeral UDP ports from outside traffic, assuming the engine worker is on the same host (the existing worker target is already `127.0.0.1`). This requires rebuilding/restarting the Rust Arbiter; restarting Node alone does not apply it.

## 4. Modern place classification

The existing XML inventory now records counts of each instance class so the audit can identify maps containing Terrain, MeshParts, unions, Folder, effects, modern GUI instances and similar classes. This is **not** a converter and does not remove modern objects. Supporting later Roblox APIs in an older compiled engine is a separate engineering task.

## 5. Verification

```powershell
py -m unittest discover -s tests -p "test_gameplay_audit.py"
py -m unittest discover -s tests -p "test_engine_core_sources.py"
```

These are source/inventory regression tests, **not** substitutes for a live game, chat, or multiplayer test. When a new matching WebClient is built, manually verify: chat input and messages between two logged-in users, sword activation on the server, actual damage/respawn, overlay shown only on real damage, and tool/character replication on a second client.
