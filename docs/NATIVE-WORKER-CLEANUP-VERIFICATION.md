# Worker retirement and Undead gameplay verification

The web adapter previously marked every native job closed on restart without
stopping its RCC process. A read-only SOAP/process audit found twelve workers
owned by the private validation Arbiter, eleven already closed in SQLite. A
direct shutdown successfully stopped a worker; no hanging CloseJob was proven.

`native-job-cleanup.mjs` now journals retirement requests in the existing SQLite
database. Restarted and stale jobs stop being advertised and are retired through
the existing authenticated Arbiter endpoint. Cleanup runs at most two requests
concurrently, persists retry deadlines, and retries after failures. Its 45-second
request deadline allows the engine's default 30-second OnClose grace period.
Fresh heartbeats preserve active jobs. A shutdown callback during OpenJob cannot
produce a join ticket, and an initially unknown job remains retryable through
the startup window. Closing the adapter aborts requests while retaining the
journal for the next restart.

Regression tests exercise restart recovery, backoff, timeout/concurrency limits,
non-starvation, fresh heartbeats, cancellation and an actual HTTP startup/shutdown
race. The Linux integration suite passes 71 tests; targeted Windows native tests
pass 12. In the marked private stack, restart automatically stopped the retained
empty RCC worker. Ten older workers were queued only after verifying their job
IDs, owning process/port, closed database record and zero live players. All twelve
baseline processes exited, the queue emptied, and the new two-player game stayed
active. Production files and the original checkout were not changed.

The Undead Coming was tested with two browser clients and original gameplay.
The survivor received a Pistol; browser activation reached the server's original
tool event. Team assignment, damage, deaths and respawns occurred. A bounded,
read-only event trace captured two original zombie-win messages followed by new
rounds. Pistol-hit damage and sustained combat remain unverified. Frequent zombie
character replacements still need investigation; these results are not a claim
of complete compatibility.

Evidence is under `tests/evidence/universal-runtime-2026-11-09/`:
`native-worker-cleanup-results.json`, `undead-two-player-summary.json`,
`undead-two-player-server-after-fire.json`, and `undead-original-round-trace.json`.

Private staging preserved a consistent SQLite backup (integrity check passed)
and the original source with a verified hash. The first running cleanup staging
used a 10-second request deadline; retirement completed quickly. The committed
45-second default preserves additional time for shutdown callbacks. No production
service was restarted or deployed.
