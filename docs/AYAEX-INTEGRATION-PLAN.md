# AyaEX-inspired stability integration plan (2x2)

Base: `main` at `725069f3e411983cf628c54cb9703c912c273307` (2026-11-07).
Work branch: `integration/ayaex-stability-pass-20261107`.

## Guardrails
- Keep 2x2's Project Pizda / UniversalClient engine, existing SQLite identities, imported maps, site appearance, ad system and native routes.
- No switch to Aya.Server, MercuryRCC, MercuryCore or a second authentication/database stack.
- Never rewrite original map files. Make source changes on this branch, review the diff and merge only after CI and runtime smoke tests.
- Preserve all `server/native/*` libraries and `site/native-client/*` builds. Don't commit secrets or production database/WAL content.
- AyaEX public repositories can be behind their private upstream. Port patterns, not binaries or unverified endpoints.

## Current baseline
- `server/lib/asset-resolver.mjs` already provides a local-first offline asset library, 15-second bounded negative cache, safe filesystem lookup and XML-only Roblox URL substitution.
- `server/lib/native.mjs` already serves `/native/asset`, `/native/content`, appearance/bodycolors, worker heartbeats and game launch/session routes.
- `server/lib/native-chat.mjs` already provides worker-protected text-filter compatibility. `server/lib/chat.mjs` provides separate site chat.
- The native engine scripts already include Topbar/Chat/Health compatibility fixes. The sidebar PNG 404s were separately addressed on main.
- These implementations are not proof that chat messages are visible in a running WebAssembly game or that RCC/Arbiter works in production.

## Phase A — asset and avatar reliability (started)
1. [x] Retain local-first resolver and binary-safe XML rewriting; do not introduce a credentialed Roblox scraper.
2. [x] Enumerate nested files referenced from avatar RBXM/RBXMX XML using bounded recursion, cycle suppression and symlink-safe paths. Include dependencies in native appearance listings.
3. [ ] Add optional operator-only missing-asset reports for imported scenes and avatar libraries; distinguish missing file, unsupported type and upstream unavailable.
4. [ ] Measure cache hits/misses and file-read latency before introducing disk/positive cache changes; keep cache versioning and eviction deterministic.
5. [ ] Verify `/api/asset?id=...`, `/native/asset?id=...`, HEAD, MIME type, XML URL rewrite, binary preservation and missing assets against real imported places.

## Phase B — in-game chat
1. [x] Preserve the legacy chat filter endpoint and distinct website chat.
2. [x] Anchor the worker-access allowlist to exact paths (regression test).
3. [ ] Trace the complete game chat path: CoreScripts/Chat.lua → runtime send → RCC/game worker filter → network broadcast → other player → UI. Record the first failing step.
4. [ ] Add explicit send/delivery/visible-message counters and reconnect/duplicate-message tests; keep private per-game chat scoped to the correct job.
5. [ ] Test real two-account joins and verify enter-to-chat, bubble chat, filtering, disconnect/rejoin and rate-limit behavior.

## Phase C — legacy client compatibility
1. [ ] Inventory the actual 2006–2010 and 2016 asset/character HTTP requests from client logs and compare with `/native/*` and `/api/asset`.
2. [ ] Add narrowly scoped aliases only for verified paths; retain gate and worker authorization boundaries.
3. [ ] Validate XML models, appearance URLs, image/mesh MIME types, redirects, content URLs and browser cross-origin isolation.
4. [ ] Keep compatibility per client family; do not assume 2016 Lua/UI scripts work in 2008 executables.

## Phase D — multiplayer/RCC stability
1. [ ] Add health probes and structured logs for Arbiter launch, RCC host creation, readiness heartbeat, lease renewal, WebSocket upgrade, active players and shutdown.
2. [ ] Regression-test stale jobs, reconnects, timeout, double launches, missing worker binaries and client authentication.
3. [ ] Reuse MercuryRCC's lifecycle and WebSocket proxy design where compatible; do not replace the 2x2 transport.
4. [ ] Validate in a real browser with two clients and a real game worker; source-level tests alone cannot establish interoperability.

## Phase E — visual and client bugs
1. [ ] Confirm sidebar legacy icon 404s stay fixed; test missing icon fallback without requesting nonexistent paths.
2. [ ] Test native UI topbar, chat panel, HealthScript and damage overlay on a newly compiled runtime, including overlay cleanup.
3. [ ] Capture render/asset console failures and map them to specific client/build and asset ID.
4. [ ] Test 2008 Crossroads and at least one other imported place, preserving working Crossroads behavior.

## Test gates
- Node: `node --test tests/ads.test.mjs tests/asset-resolver.test.mjs tests/native-avatar-deps.test.mjs tests/native-chat.test.mjs`.
- Python: `python -m unittest discover -s tests -p test_engine_core_sources.py -v`.
- GitHub Actions: Linux and Windows `source-integration.yml`; inspect failures before merging.
- Integration: launch a real game, inspect asset responses, and complete a two-player chat/reconnect test. A passing unit suite is **not** a passing runtime test.

## AyaEX reference implementations
- MercuryCore: `Site/src/routes/(rbxclient)/asset/+server.ts`, `Site/src/lib/server/assetAuth.ts`, `Site/src/routes/(rbxclient)/asset/characterfetch/[username]/+server.ts`.
- MercuryCore shoutbox: `Site/src/lib/server/shoutbox/live.ts` and `Site/src/routes/api/shoutbox/stream/+server.ts`.
- MercuryRCC: `Orbiter/Orbiter.go` and `Proxy/gameserver.go`.
- AyaEX release repository: the native 2016 client source is **not public**, so it cannot be ported as editable engine source.

## Rollout
Merge only a reviewed PR after checks, deploy to a staging instance and smoke-test native joins. Keep the preceding deployment available for immediate rollback. No automation should overwrite the local `C:\RBXBanland` working tree.
