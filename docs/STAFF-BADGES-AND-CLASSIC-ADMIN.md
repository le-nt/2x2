# Classic 2x2 staff badges and administration skin

This branch adds cosmetic, server-derived staff role labels to the existing Node/SQLite website.

## Role-to-artwork mapping

- `SuperAdmin` and `Administrator`: uploaded hammer-and-laurel Administrator artwork.
- `Moderator`: uploaded scales-of-justice artwork.
- `ForumModerator`: uploaded document-and-gear artwork.
- `AssetManager`: uploaded image-and-gear artwork.
- `Unprivileged`: no special badge.

Artwork is user-provided and distributed in the separate installation ZIP. The web files use `/img/staff-badges/{role}-48.png`. Put the 24px versions under `services/engine/.assets/content/textures/ui/2x2StaffBadges/` for the legacy native client. The copy operation does **not** recompile `UniversalClient.data`.

The native `PlayerlistModule.lua` replaces the historical external Roblox group badge check with a 2x2 staff-role marker and a best-effort read-only role query. The legacy `HttpRbxApiService` route mapping must be tested in a running browser client. A server-replicated `StringValue` named `2x2StaffRole` on each `Player` is an alternative reliable source. The badge code is cosmetic; it never conveys permissions.

## RobloxLabs adaptation

The GitHub project [RobloxLabs/web](https://github.com/RobloxLabs/web) is a **fan-made** ASP.NET Core recreation of the 2013 Roblox website, released under the MIT license. Its `wwwroot/CSS/Base/CSS/Admin.css` and `Admin2.css` informed the classic administration CSS in `site/css/admin-classic.css`. There was no verified operational internal Roblox moderation backend in that project to port. 2x2's own TOTP, staff roles, account moderation, appeals, site banner, audit, and diagnostics remain the real backend.

## Integration precautions

- Merge into the installed Node admin system rather than overwriting locally modified `server/server.mjs`, `server/lib/api.mjs`, or `site/js/common.js`.
- Test `node --test tests/admin.test.mjs` and `node --check server/server.mjs`.
- Rebuild or repack native-client assets only when ready. The native artwork and Lua module changes are source assets, not a completed production binary build.
