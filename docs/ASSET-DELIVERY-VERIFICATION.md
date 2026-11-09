# Asset delivery verification — 9 November 2026

This extends the existing resolver; local archives and VFS remain first. Production maps, database and binaries are untouched.

## Live findings

The low-volume Windows comparison used 28 endpoint requests across Open Cloud, legacy v1 bytes, legacy v1 location, and legacy v2 location. Where both interfaces allowed access, assets 182393478 and 34854607 had identical bytes/SHA-256 and `roblox-assetid`, `roblox-assetversionnumber`, `roblox-assettypeid` headers. Version 1 of 182393478 also matched. Invalid versions and missing IDs failed; metadata endpoints sometimes encoded 401/404 errors inside HTTP 200 JSON. Open Cloud permitted 1029523 and 151199377 while anonymous legacy routes denied them.

Truss's Hetzner rates were not reproduced or assumed. Returned rate-limit headers differed, no test triggered 429, and CDN headers also advertised limits. These are observations, not throughput guarantees. Legacy metadata has one `location`; the v2 shape has `locations`. Official references: [legacy endpoint catalog](https://create.roblox.com/docs/cloud/reference/domains/assetdelivery), [Open Cloud asset endpoints](https://create.roblox.com/docs/cloud/reference/features/assets).

## Integrated behavior

- Default order preserves local/archive → configured Aya → scoped Open Cloud → anonymous legacy v1 location → legacy v1 bytes. `ROBLOX_ASSET_FETCH=0` disables both public legacy routes. `ROBLOX_ASSET_DELIVERY_PREFERENCE=legacy_v1` opts into trying anonymous v1 location before Open Cloud; it does not authenticate v1 or grant asset access. Open Cloud remains available for permitted assets denied by anonymous routes. No Roblox session cookies are accepted or collected.
- Existing numeric files remain valid. New successful retrievals retain exact bytes and SHA-256/identity/version/provider metadata in `server/native/asset-metadata`. Signed CDN locations and credentials are not persisted. Permanent seeding remains enabled by default, respecting the existing configured archive/storage limits and explicit persistence opt-out.
- Pinned versions use separate `.vNUMBER` identities. An unversioned file can satisfy a pin only when saved metadata and its verified hash establish the exact version. Version pins survive XML/binary discovery, recursive seeding, native media requests and launch prefetch. Simultaneous latest/pinned requests share a CDN transfer after their identities agree.
- 429 responses establish a shared hostname cooldown, honoring numeric or HTTP-date `Retry-After`. Other asset IDs and alternative routes on that host cannot immediately retry it. Native/website media responses preserve 429 and Retry-After. No proxy rotation, account cycling or automatic retry loop is used.
- Bulk import seeding now processes a bounded batch (default 3, `--concurrency 1..6`), recursively follows available models and pinned dependencies, deduplicates requests and publishes explicit deferred coverage when limits prevent completion. Existing non-blocking launch prefetch remains compatible.

Evidence: `tests/evidence/universal-runtime-2026-11-09/live-delivery-endpoint-comparison.json` and `live-integrated-delivery-results.json`. The integrated fresh-store test exercised anonymous v1 plus scoped Open Cloud fallback, matched original hashes, removed the temporary cache, restarted the resolver and served every request from the permanent archive without downloading again. Offline regression tests cover identity mismatches, forbidden redirects, errors-in-200 responses, 429/cooldowns, persistence, pins, recursion/concurrency and native HTTP compatibility.
