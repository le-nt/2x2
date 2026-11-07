# 2x2 — classic website and native game-service integration

## What works in this package

The classic website runs directly, with no Windows desktop, taskbar, Start menu, fake browser, or emulator. Login/sign-up, profiles, catalog, avatars, friends, forums, guestbook, chat and website-era selection keep their existing backend. Product branding is 2x2. Existing database and cookie identifiers are retained so an upgrade does not intentionally erase accounts.

Play records the existing visit and opens a 2x2 launch page. That page resolves a configured numeric native place ID and offers **Enter Game**, opening Project Pizda's actual `/games/start?placeId=...` flow. The full native engine, website, Arbiter, deployment server, and Sherlock sources are included under `services/`. Sherlock is also copied into the website's missing submodule directory.

## Important: this is not a ready-to-play engine build

Both uploads contain source code, not a compiled UniversalClient.js/wasm/data bundle. The new engine uses a different backend and place database; simply replacing BoxedWine's JavaScript cannot run it. No native client build, live game join, compatibility of the classic maps with the newer engine, or game-service deployment was verified here.

The website and native service still have separate accounts, sessions, avatar catalogs, and databases. There is no implemented single sign-on or automatic account/avatar/place migration. This package is a source integration with a real native launch handoff, not a completed unification of those systems. Do not deploy it expecting the old SQLite accounts to authenticate to the native service.

## Start the classic website

1. Install Node.js 24 or newer.
2. Extract this folder to a new location. To upgrade, back up your existing installation first; copy its `server/data/` and `server/config.json` into this folder. Do not overwrite them with empty files.
3. On Windows run `start-2x2.bat`, or run `node server/server.mjs 8090` from this folder.
4. On first start the console shows a generated entrance key. Existing installations keep their configured key. Visit `http://localhost:8090/` and enter it.

The batch file starts the classic website only. It does not compile or start Project Pizda's services.

## Set up the native side

Use the included source READMEs for their prerequisites:

- `services/engine/README.md`: CMake, VCPKG, Emscripten, FMOD and the native client/RCC build. The Emscripten presets are in `CMakePresets.json`. Supply the required licensed FMOD libraries yourself.
- `services/website/README.md`: Bun, PostgreSQL 16+, Redis, S3-compatible storage and service configuration. Set up the database, assets, users, signing keys and games.
- `services/arbiter/README.md`: game/render worker service. This needs a compatible RCC build and a configured website connection.
- `services/deployserv/README.md`: WebClient distribution service.

Deploy the native website at an HTTPS origin such as `https://play.your-domain.example`. Publish the compiled WebClient with the deployment server, and make its response endpoints accessible with the required CORS and cross-origin isolation headers. In the native website set `PUBLIC_SETUP_ORIGIN` and `PUBLIC_CLIENT_SETTINGS_ORIGIN` to the actual HTTPS origins of your deployment and client-settings services. These explicit settings replace the original assumption that every hostname starts with `www.`. If omitted, the upstream hostname replacement behavior is retained.

The native loader no longer forces every WebSocket connection to `ws://localhost:5173`. It uses the game's supplied connection destination. It also rejects cached bundles whose stored verification hash does not match the expected hash. These are source edits; the Svelte application still needs to be built and tested with its dependencies.

## Connect classic places to the native service

1. Import each `.rbxl` into the native service, creating real place/universe records and assets. Test compatibility in the native client.
2. Get its real numeric place ID. Classic IDs such as `2008m-crossroads` are not native numeric IDs.
3. Merge this section into your existing **server/config.json**, preserving its other fields:

```json
{
  "nativeClient": {
    "origin": "https://play.your-domain.example",
    "placeIds": {
      "YOUR_EXACT_CLASSIC_ID": 123
    }
  }
}
```

`123` is an example, not an imported place. Use the exact classic ID from `site/data/maps.json` and the actual native ID. `server/native-client.example.json` is an empty configuration template. Restart the classic server after editing config.

4. Log in to the native game-service account on its origin. On the classic website choose a game, Play, then Enter Game. Missing configuration/imports produce an explicit message rather than silently falling back to Wine. Visits remain classic website visits; they do not prove the native client successfully joined.

Classic sessions and passwords are never embedded in the handoff URL. The native service authenticates with its own session. A full account merge would require a separate authenticated identity bridge and data migration.

## Verification performed

`node --test tests/*.test.mjs` checks ID mapping, unconfigured places, and unsafe URL rejection. `tests/smoke.mjs` checks the actual classic HTTP server, gate, registration, session, public pages, and native-launch errors in an isolated database. JavaScript syntax and local HTML asset links were checked. These checks do not validate the native C++ build or multiplayer game joining.

Original engine identifiers and third-party notices remain intact; renaming internal Roblox protocol strings would break compatibility. `clients/` remains available for content/avatar tools and map import. Obsolete served emulator folders and desktop apps have been removed. Older server documentation describes legacy emulator features and should not be treated as the setup guide for this integration.
