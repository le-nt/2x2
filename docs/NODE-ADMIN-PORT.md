# Native 2x2 administration (Node/SQLite port)

The legacy Bun/SvelteKit CS pages under `services/website/src/routes/(admin)/cs` are kept as reference. The running Node website uses `/cs` → `/admin.html` and `server/lib/admin.mjs`.

## Install and first sign-in

1. Deploy the PR through your usual Git workflow, restart `node server/server.mjs`, and log into the normal 2x2 website.
2. Navigate to `/cs`.
3. The first account (user ID 1) and usernames listed in `server/config.json`'s optional `admins` array are bootstrap SuperAdmins for compatibility with the existing site. **Configure these accounts deliberately**; on a new public deployment, do not rely on ID 1 being a trusted owner.
4. Enter the existing account password once to generate a TOTP secret, add it to an authenticator app, then confirm a six-digit code.
5. Subsequent staff visits require a new authenticator verification. Admin sessions are separate from website sessions, bound to the original website session, and expire after six hours.
6. SuperAdmins can assign other users staff roles under Staff roles. The newly appointed staff member then enrolls their own authenticator.

No additional npm packages are required. Tables are created additively when the Node server initializes; the existing SQLite database and user accounts remain in place. Back up `server/data/2x2.db` (or `rbxbanland.db`) before deployment.

## Implemented controls

- Password-confirmed TOTP registration, encrypted TOTP secrets, rate-limited verification and server-validated elevated sessions.
- Hierarchical roles: ForumModerator, AssetManager, Moderator, Administrator, SuperAdmin. The current version implements user moderation from Moderator upward; additional role-specific functions can be added later.
- User search and summary, warnings, 1/3/7/14-day restrictions, permanent deletion, restoration, staff notes and moderation history.
- Classic Roblox-inspired `/not-approved.html` interstitial for warnings and bans, warning acknowledgement, expiry times and a one-appeal-per-action appeal workflow.
- Moderation appeals review inbox with staff responses and separate enforcement reversal.
- Sitewide text-only announcement banner, edited by Administrators and rendered in shared website pages.
- Read-only native game job heartbeat / Node process monitor, and local cached Roblox asset lookup.
- Database audit log and staff-role assignments.
- Live switches for new account registration and forum posting (both enabled by default).
- Restriction checks on normal website session lookup and login.
- Origin/JSON requirements for state-changing admin requests.

## Currently not ported

The old CS tree contains partially implemented or dependent views: asset import/review (cache inspector is read-only), IP/alt investigations, abuse report backlog, beta invitation redemption, and Arbiter enrollment. Advanced economy correction, catalog publishing, automated rollbacks, and remote server control are not ported. Those flows require their own Node models and service integration; the current UI does not display fake controls for them.

## Testing

Run `node --test tests/admin.test.mjs` and `node tests/smoke.mjs` with Node 22+ (the server recommends Node 24+). The GitHub Actions source-integration workflow runs admin tests on Linux and Windows.

## Security notes

- Never make the entrance key or access-token gate a substitute for staff authentication.
- Never publish `server/config.json` with real application secrets. Rotate the website secret after any exposure and note that changing it invalidates stored encrypted TOTP secrets, requiring re-enrollment.
- Do not allow untrusted account creation before ownership of bootstrap user #1 is established.
- Audit authorization independently before handling real moderation workloads.

## Moderation notice behavior

A new moderation action is recorded in SQLite. Normal signed-in website requests are redirected to `/not-approved.html` while a warning awaits acknowledgement or a ban/deletion is active. The shared page shell checks for notices every 15 seconds. The user sees the moderator's public reason and timestamp. Warning acknowledgements are recorded by action ID. A restricted user may sign in solely to read the notice, log out, or submit one appeal; other authenticated API and game-launch access is blocked. Active native game sessions already connected before the action may need additional runtime disconnection integration.

## Banner settings

An Administrator or SuperAdmin uses the **Sitewide banner** page at `/cs` to enable/disable a 240-character text-only banner. It appears on website pages using the `RB.mount()` shared shell. It is not injected into independent older client UIs or separate non-RB pages.
