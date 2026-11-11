# 2x2 -> Intelinsidecom/Roblox-Website migration

This branch includes the **actual 2016 website source** as a pinned Git submodule and begins a frontend switch, not a stylesheet replacement.
Source: https://github.com/Intelinsidecom/Roblox-Website (branch `2016`).
The 2016 website uses ASP.NET Framework 4.x / IIS; 2x2 uses Node.js and SQLite.

## Safe test setup using D:\2x2-integration (recommended)

This is the active development route after the production rollback. **Never** switch or reset the restored D:\RBXBanland installation to test this migration.

Download the two testing scripts from this branch into a temporary folder, then run:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup-2016-integration.ps1 -DownloadWebsite
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-2016-integration.ps1
~~~

The setup script is **hard-coded to refuse paths other than D:\2x2-integration**; it saves a copy of the test server file before adding its proxy hooks and downloads the real 2016 GitHub ZIP instead of using a Git submodule. The launcher uses **http://127.0.0.1:8091** for 2x2 and **127.0.0.1:8090** for IIS Express, and puts SQLite in the separate **D:\2x2-integration\.2016-test-data** directory. The restored production account database, server processes, maps, and WASM client are untouched.

You must have .NET Framework build dependencies / IIS Express installed to execute the ASP.NET site. If the ASP.NET source needs building, use \`-Build\` with the test launcher. See the source repository's README.

The 2016 website source alone is not a working 2x2 identity/catalog migration. Logging in on the original ASP.NET website and logging in through the 2x2 API are **not yet unified**. The test environment intentionally starts with a separate empty account database. Do not deploy or merge the draft PR until that work is finished.

## What is implemented here

- When `RBX_2016_WEBSITE_URL` is set, requests for website pages (including `/`, `/Home`, `/Games`, `/Login`, and the 2016 site's styles and handlers) are forwarded by the existing 2x2 public Node entrypoint to the **real running ASP.NET application**.
- The existing 2x2 gate stays in front of the site.
- 2x2 keeps ownership of `/api/*`, `/native/*`, the server-side asset resolver, administration and moderation API, and the browser gameplay page `/play.html`.
- The original site is **not** silently served if the 2016 site fails; the proxy returns 502 instead.
- No original databases, client binaries, map files or account records are overwritten.
- When the environment variable is unset, the original 2x2 website is unchanged.

## Running the first migration stage (Windows)

1. Keep your **existing 2x2 directory and database** untouched. Run this branch in a separate checkout. Do not overwrite `D:\RBXBanland`.
2. The actual 2016 website source is now pinned as the Git submodule `third_party/Roblox-Website`. Retrieve it with `git submodule update --init --recursive` (the first download is large). Install the .NET Framework 4.8.1 targeting pack, Visual Studio build tools and IIS Express required by the upstream project. Build the ASP.NET project before testing.
3. Use the provided launcher to initialize the source, build (optional) and start IIS Express plus Node:

```powershell
.\\tools\\start-2016-website.ps1 -Build
```

This is a local development launcher, not a production deploy. The website is hosted at `http://127.0.0.1:8090` and Node serves the usual public 2x2 port. If you already have Node running, stop it first or use `-SkipNode` and set `RBX_2016_WEBSITE_URL=http://127.0.0.1:8090` in the environment of your separately started Node process.

4. Visit the normal Node 2x2 address. The root route should now be served by ASP.NET **after** the existing 2x2 access gate. Test `/api/me`, `/api/native/launch?id=2008m-crossroads`, and `/play.html?id=2008m-crossroads` independently.
5. Run `node --test tests/website-2016.test.mjs` for the proxy test.

## Migration still required — DO NOT deploy as a completed migration

The ASP.NET website currently has its own **account/session/database assumptions**, and 2x2 uses its own SQLite sessions. Routing requests does not transfer identity. Before enabling production: implement a secure server-to-server identity bridge or migrate authentication, update ASP.NET controllers/views to use the live 2x2 account/game/catalog APIs, wire its game details into the working `/play.html` launcher, port profiles/friends/inventory/ads, validate its routes and static dependencies, and test stateful operations end to end. The 2016 recreation's `GamesController` currently contains only a commented stub. Do not claim games are integrated just because `/Games` renders.

**No replacement of `main` or production deployment has occurred.** This is the first bounded routing commit in a larger application migration.
