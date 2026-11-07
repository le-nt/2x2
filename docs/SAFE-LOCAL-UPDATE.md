# 2x2: source integration and safe live-server updates

## Integrated source

The current `main` version is the authoritative implementation for native HTTP asset routing, 2016 CoreScripts (Topbar, Chat, HealthScript), and the categorized advertisement endpoint. These changes already include the earlier native compatibility, chat and ad work. The recovery branch's original 62 PNG creatives have been imported **without overwriting** newer implementations.

The Windows test changes in this integration only skip the symlink-security *test* when Windows denies creation of a test symlink. They do not change asset resolver security.

## Important: live databases are currently tracked by Git

Older commits **already track** `server/data/rbxbanland.db-wal` and `server/data/2x2.db-wal`. The existing `.gitignore` entries do not stop Git from managing files that were committed before the ignore rules. Consequently, `git stash`, `git reset`, and branch changes on a running server may change a SQLite WAL and make account/friends data appear to vanish.

**This PR deliberately does not remove or rewrite those tracked files.** Deleting a tracked WAL from a Git commit could delete the corresponding local WAL on checkout; it is not a safe automatic migration. A separate, explicitly planned migration should relocate runtime database state outside the Git worktree, update server configuration, and create a verified SQLite-consistent backup before untracking the old copies.

Until that migration:

1. Stop the Node server and every process accessing SQLite before modifying Git history.
2. Preserve the main `.db` **and** associated `-wal`/`-shm` files together in an external backup before any checkout or pull. Prefer a SQLite online backup API if the server is running.
3. Never `git add -A`, stash with unreviewed database changes, or use `git reset --hard` in the live worktree.
4. Do not treat a clean automated test suite as proof that an existing live database is intact. Verify logins/friends separately from the source release.
5. Keep the compiled WASM/data assets and imported map files with their original versions unless intentionally rebuilding them.

## Deploying the integration to an existing live checkout

**Do not pull this PR into a live dirty checkout.** Review the PR and merge it into GitHub `main` only after source checks. The current recovery branch includes locally preserved fixes, while this integration incorporates that recovery history as a merge parent so the history can be reconciled without automatically discarding newer main implementations.

The native C++ and bundled 2016 Lua CoreScript source changes require a **matched client build and assets** to become active in the browser. Updating the source tree alone does not update a previously compiled WASM.

For verification: `node --test tests/asset-resolver.test.mjs tests/ads.test.mjs` and `py -m unittest discover -s tests -p test_engine_core_sources.py -v`. Tests involving symlinks may skip only if Windows denies creation.
