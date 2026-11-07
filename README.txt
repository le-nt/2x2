2x2 EMERGENCY ROLLBACK - CLIENT LAUNCH

This replaces ONLY site/js/native-test.js. It bypasses the optional
legacy-asset preloader introduced during Phases 7-9, which is breaking launches.
The native client manifest, args, launch endpoint, and websocket flow are preserved.
No maps, registry, tools, or server files are modified.

1. Copy C:\RBXBanland\site\js\native-test.js to native-test.js.before-rollback
2. Copy site\js\native-test.js from this zip to C:\RBXBanland\site\js\native-test.js
3. Restart the website server and refresh with Ctrl+Shift+R.
4. Test Crossroads first, then a second place.

NOTE: This restores the launch PATH; it does not repair missing legacy assets.
Do not apply the Phase 7 or Phase 9 JS files over this recovery file.
If an old page still requests native-legacy-loader.js, that is harmless; it
is no longer referenced by this launcher.
