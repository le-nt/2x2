# 2x2 / RBXBanland — Novetus multi-client staging

This package extends your current RBXBanland source **without replacing the working 2008M or 2010L clients**.

## What it changes

- Adds a `Client` dropdown to `site/play.html`, listing only versions registered in `site/data/maps.json`.
- Keeps each map's existing default client unless a different version is explicitly selected.
- When you choose an alternate client, launches using `exe=client` and the existing Lua script path. This is experimental: older/newer engines may require different launch scripts and map formats.
- Lets `scripts/build_data.py` automatically find compatible locally staged `clients/<version>` folders and build their content-hashed overlays.
- Adds `--clients-only` to rebuild/register new clients **without touching `root.zip` or rebuilding the map archive/catalog entries**.
- Adds `--client 2011M` (repeatable) for staging one or several versions.

## Install

From WSL with the package extracted:

```bash
python3 apply_2x2_multiclient.py --root /mnt/c/RBXBanland
```

The patch makes `.before-multiclient` backup copies of the two modified files. It is safe to rerun.

## Get and stage Novetus clients

Obtain a Novetus release or snapshot from its official project page: https://bitl.itch.io/novetus . Download/extract it locally and inspect its client directory structure yourself. The Novetus launcher and historical Roblox client binaries have different redistribution terms; verify permissions before uploading them to a public 2x2 server.

For each tested version (for example `2011M`, `2011E`, `2009L`, or `2012M`):

1. Find the extracted folder that directly contains `RobloxApp_client.exe` plus that client's DLLs and `content/` directory (this location varies by snapshot).
2. **Copy**, don't move or overwrite, its contents to `C:\RBXBanland\clients\2011M\` (substitute the actual version identifier). Keep its relative DLL and asset paths.
3. Your staged folder must have `content/scripts/solo.lua`. The currently working `clients/2010L/content/scripts/solo.lua` is a **starting template only**, not proof of compatibility; copy it into the staged version and keep the original client's files as a backup. Some clients require version-specific APIs, signatures, or script changes.
4. Verify `clients/2011M/RobloxApp_client.exe` exists and `clients/2011M/content/scripts/solo.lua` exists.

**Security:** old Roblox clients may contain known network vulnerabilities. Test offline/in a sandbox; don't connect untested historical binaries to arbitrary public servers. Don't commit downloaded binary packs to GitHub by accident.

## Package without rebuilding the maps or Wine root

```bash
cd /mnt/c/RBXBanland
python3 scripts/build_data.py --skip-root --clients-only
```

Or stage only one version:

```bash
python3 scripts/build_data.py --clients-only --client 2011M
```

This writes/updates `site/data/client-<version>-<hash>.zip` files and adds their names to `site/data/maps.json`. It preserves existing map entries and client mappings. Existing clients remain available.

If the site is served directly from your checkout, restart or refresh the server as needed. If your hosting uses a separate deployment folder, publish only the intended generated files and patched pages after verifying permissions. **Existing URLs are unchanged**.

## Try it

- Open a known 2008 map as usual. The selector defaults to the map's assigned version.
- Select `2011M (experimental)` to test that version; the site reloads with `?client=2011M&exe=client`.
- If a new client hangs or crashes, change the selection back to `Default` (or remove `client` from the query). This does not remove the older working client.
- Begin with an empty/baseplate map; later Roblox client versions may not read older `.rbxl` files identically.

**This patch adds infrastructure, not actual new Roblox clients or a speed improvement.** It does not change the BoxedWine runtime, WineD3D renderer, JIT implementation, or existing browser-shell files. Benchmark new clients only after confirming they launch and load a simple map.

## Restore

```bash
python3 apply_2x2_multiclient.py --root /mnt/c/RBXBanland --restore
```

The restore command restores both modified source files from their backups. Generated ZIPs and catalog registration are not automatically removed; revert the generated `maps.json` from your own backup or version control if necessary.
