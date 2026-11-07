# 2x2 server

Run `node server/server.mjs 8090` from the project root with Node.js 24+.

See the root README.md and NATIVE-READINESS.md for native engine setup, key protection, compilation requirements, map import, and tests. The server uses the existing entrance key and SQLite accounts; native workers authenticate separately for asset and heartbeat routes.

The native engine binaries are not present in the supplied source archives. A build and real game join remain required.
