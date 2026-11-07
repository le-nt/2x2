# Compatibility and community UI update

## Install website changes

Use the real `C:\RBXBanland` checkout. Pull the reviewed branch, then restart the Node website server. Existing accounts, map IDs, map files, runtime repairs, game tickets and WebSocket routing are retained.

The website changes and damage-overlay asset require no client rebuild. The new chat service also needs the RCC URL change below before the engine can reach it.

## Audit the current map files

From PowerShell in `C:\RBXBanland`:

```powershell
py tools/build-place-manifests.py --root C:\RBXBanland
py tools/audit-gameplay-compat.py --root C:\RBXBanland --write
```

Rebuild manifests first: binary inventory now retains class counts and linked-script IDs. The auditor accepts `inventoried_binary`, reports every skipped place, and separates undecoded sources from known empty sources. A PNG or mesh cannot count as cached linked Lua. Reports remain static evidence, not a declaration that a map's gameplay works.

Validation against the 348 original Novetus source files inventoried 344 and explicitly reported four binary decoding failures. Those source fixtures do not include the live deployment's asset cache or manual map repairs, so their missing-asset totals are not a live-site diagnosis.

## Native chat: RCC only

The old URL builder turns the deployment base into a `www` domain and discards `/native`. For RCC builds, only player chat settings and text filtering now use the existing `RBX_INTERNAL_BASE_URL` environment value. Arbiter already supplies that value and the worker access key.

If the running RCC is built in the separate WSL engine checkout, apply the two functions there, preserving unrelated changes:

```bash
python3 /mnt/c/RBXBanland/tools/patch-native-chat-rcc.py --engine ~/2x2-build/engine
cmake --build ~/2x2-build/engine/build/linux-rcc-release --target RCCService --parallel 2
```

The patch makes a dated source backup and stops if either target function has unexpected custom changes. It is safe to rerun. After a successful build, restart Arbiter and join a fresh game worker. Do not rebuild UniversalClient/WASM for this change.

The server implements:

- `GET /native/api/game/players/:id` → `{"ChatFilter":"blacklist"}` for known users.
- `POST /native/api/moderation/filtertext` → `{"data":{"white":"…","black":"…"}}`, using the engine's URL-encoded form protocol, with optional gzip.

Filtering requires the worker key. A browser may read only its own chat metadata. The text service removes control characters, limits message size/rate, and optionally masks literal terms from `native.chat.blockedTerms` in `server/config.json`. Both legacy policy names use this same local policy. With no blocked terms configured, ordinary text passes through; this is not Roblox's hosted or age-specific moderation service.

HTTP tests validate the protocol and authorization. A small C++ harness compiles both worker and client URL-builder branches with dependency stubs. A complete RCC build and two-player in-game chat test are still required on the deployment machine.

The missing hurt-overlay ID `34854607` now resolves to an original, locally generated transparent red vignette. The generator is reproducible; existing CoreScripts control when the overlay appears. Its HTTP delivery is tested; the actual damage effect still needs an in-game check.

## Community artwork and headshots

Drop PNG, JPG, JPEG, GIF, WebP or AVIF files into `site/img/ads/`. The server discovers them automatically within 15 seconds. There is no manifest to edit and no restart needed for new images.

Each navigation chooses two different images where possible. Desktop rails use 160 × 600 slots and `object-fit: cover`; the tree image has a focal-point adjustment. Rails disappear below 1280 px and stay out of the running game and login landing page. Empty folders or failed ad requests do not block the website.

The three supplied images are included as optimized WebP files. They also appear in the home banner, community panel, forum header and sidebar art card. Header and sidebar initials now use the same avatar headshot renderer as Home, loaded on demand on pages without an avatar script. The CSS fallback also frames headshots instead of full-body avatars.

Browser review used local sample accounts. Full-site account/worker authorization was checked separately against the real Node server in a throwaway test database.
