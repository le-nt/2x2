# 2x2 -> Intelinsidecom/Roblox-Website migration

This branch includes the **actual 2016 website source** as a pinned Git submodule and begins a frontend switch, not a stylesheet replacement.
Source: https://github.com/Intelinsidecom/Roblox-Website (branch `2016`).
The 2016 website uses ASP.NET Framework 4.x / IIS; 2x2 uses Node.js and SQLite.

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
