# Complete Novetus map-pack update

Imported source: https://github.com/Novetus/Novetus-Map-Pack
Pinned commit: `6d7c962e3afe81d61a868b301771767d06471426`.

## Included

All **348** map files in `maps/` and `legacy/` are included, covering 2006–2017 plus development maps, Universal variants and Novetus exclusives. There are **322 unique map contents**; identical copies remain separate catalog entries so legacy/current variants are not dropped. The pack contains 344 XML places and 4 binary places. Both formats are preserved.

The exact `maps/2008/2008M/2008M - Crossroads.rbxl.bz2` is imported as `2008m-crossroads`. The original 50 catalog IDs are retained, including existing thumbnails and visit metadata. Existing native numeric IDs remain stable. New IDs are assigned only for new entries.

The original compressed repository archive and a source index are included in `map-pack/`; the installer works offline. Every compressed map is checked against its upstream Git blob hash before import. Decompressed files are stored by SHA-256 and byte-identical copies share storage. Map descriptions and source paths are retained. Original places remain the work of their respective creators.

Allow roughly **3 GB of free disk space** for the decompressed native maps and temporary files. The 322 unique maps occupy about 2.30 GB before filesystem overhead; older files and backups are retained.

## Install

1. Stop the old Node server with Ctrl+C in its console. Close any other 2x2 server window listening on 8090.
2. Extract this update ZIP outside your current project.
3. In the extracted update folder run:

```powershell
py tools\install-update.py --root "C:\RBXBanland"
```

This applies the complete native-server update, fixes the effects error, and imports every bundled map into your existing project. Your entrance-key config, account database, compiled WebClient and existing numeric place IDs are preserved. Changed source files and the previous catalogs are backed up.

4. Start the updated project, not the extracted update folder:

```powershell
cd C:\RBXBanland
node server\server.mjs 8090
```

5. In another terminal verify that the process on port 8090 is actually the new server:

```powershell
cd C:\RBXBanland
node tools\verify-running-server.mjs --url http://localhost:8090
```

6. Hard-refresh your browser with Ctrl+F5. Games lists the expanded catalog and its era filters.

If you have already copied the files into the project, you can run the importer directly:

```powershell
py tools\import-novetus.py --root "C:\RBXBanland"
```

The importer is repeatable: it updates source metadata without assigning new IDs to existing maps, duplicating catalog rows, or resetting existing visit metadata. It imports both current and legacy maps by default.

## Your `/api/native/launch` 404

A missing map in the integrated adapter returns a **503 JSON explanation**. A **404** at `/api/native/launch` suggests that the process serving port 8090 is an older server or did not receive the native-server files. Adding map files alone will not repair a missing API route.

The update includes the full server adapter and a gated `/api/native/version` endpoint. `verify-running-server.mjs` checks the process you are reaching using your existing key configuration, without printing the entrance key or its cookie. It distinguishes an old/wrong server (404), a different config (401), and the installed native adapter. The new launcher also explains this specific 404 instead of reporting a generic resource error.

The patched start batch checks an already-running server's version, so it does not silently reuse an old process.

## Validation and remaining requirements

All 348 source maps were imported in the workspace, with zero missing entries from the original catalog. Tests cover repeat imports, preserved IDs/visits/thumbnails, current/legacy variants, XML/BOM/binary formats and unsafe ZIP paths. HTTP tests exercise the Crossroads launch route and verify its served content hash, plus binary-byte preservation, the entrance-key gate, shared identity, tickets and WebSocket authorization.

**Importing maps does not compile the native client or RCC server, and does not prove that every historical map works in the native engine.** The upstream pack notes that Universal/Novetus Exclusive maps can need Novetus local assets. Compiled native binaries and a real game join are still required. There is no Wine fallback.

## Source files

- `tools/import-novetus.py`: complete pinned pack importer, directory/ZIP inputs and optional `--download`.
- `map-pack/source-index.json`: verified repository paths, blob IDs and sizes.
- `server/native/novetus-import-report.json`: generated import inventory after installation.
- `tools/verify-running-server.mjs`: diagnoses an old process versus the installed server.
- `tools/install-update.py`: applies files without replacing keys/accounts, then imports the complete pack.
