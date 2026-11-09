# Native social compatibility — 2026-11-09

Gaming Room's original scripts failed `IsInGroup`, `GetRoleInGroup`, and
`GamePassService:PlayerHasPass` because their legacy LuaWebService routes were
missing. `native-social.mjs` now handles the exact native paths through the
existing worker/session authorization boundary.

Per the user's temporary policy, groups always report non-membership:
`IsInGroup=false`, `GetRankInGroup=0`, `GetRoleInGroup="Guest"`. A future group
API can replace these responses in this adapter without changing places.
Ranks retain their numeric type so original comparisons continue working.
Accepted friendships use the existing local friendship records. Game-pass
ownership uses explicit local `native_game_passes` records; absent records
return false. No Roblox identities, memberships, purchases or privileges are
inferred from matching numeric local user IDs.

The real RCC probe caught a protocol distinction: boolean/integer responses
require typed XML, but the engine's string overload returns the raw HTTP body.
Role names therefore use plain text. HTTP regression tests cover both formats,
accepted/pending friendships, explicit/missing pass records, malformed inputs,
session ownership, wrong credentials, and complete-path worker allowlisting.

Validation: 67 Linux asset/native integration tests and seven targeted Windows
social/chat/persistence tests pass. A broader Windows run stalled in the
pre-existing asset-resolver test process and was stopped; it is not reported as
passing. `probe-native-social.py` verified the actual RCC API values, without
changing memberships or purchases. In the isolated Gaming Room retest, recorded
LuaWebService/RawCallback errors fell from 15 to zero. Browser input opened the
original Help menu and equipped the controller, displaying its console-ID UI
and holding pose; original rank leaderstats displayed Guest. A complete console
minigame round is not yet verified.

Two unrelated original source defects remain: RankGUI connects an undefined
callback before declaring it, and a room-specific UpdatesButton script also
exists in StarterGui and assumes its room hierarchy. Original scripts were not
rewritten to hide these defects.

Evidence: `tests/evidence/universal-runtime-2026-11-09/native-social-real-results.json`
and `gaming-room-social-regression.json`. Changes were deployed only to the
marked private validation stack, after source-hash checks and consistent SQLite
backups with successful integrity checks. Production files were not changed.
