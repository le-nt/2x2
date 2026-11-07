#!/usr/bin/env python3
"""Prepare RBXBanland for staged Novetus clients without replacing existing clients.

Usage: python3 apply_2x2_multiclient.py --root /mnt/c/RBXBanland
       python3 apply_2x2_multiclient.py --root /mnt/c/RBXBanland --restore
"""
import argparse
from pathlib import Path
import shutil
import sys

BUILDER_OLD = '''if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    if "--skip-root" not in sys.argv:
        build_root()
    zips = {name: build_client(name) for name in ("2007M", "2008M", "2009E", "2010L")}
    build_maps(zips)
'''
BUILDER_NEW = '''# Clients are staged locally in clients/<version>. Never download or overwrite them.
# A separate, client-only build lets existing maps stay intact while testing new versions.
CLIENT_ID = re.compile(r"^[0-9]{4}[A-Za-z][A-Za-z0-9_-]*$")


def staged_clients():
    base = os.path.join(PORT, "clients")
    result = []
    for name in sorted(os.listdir(base)):
        folder = os.path.join(base, name)
        if not os.path.isdir(folder) or not CLIENT_ID.fullmatch(name):
            continue
        # A raw Novetus folder is not necessarily directly launchable by RBXBanland.
        # Only publish versions that have the browser's required startup script.
        required = (
            os.path.join(folder, "RobloxApp_client.exe"),
            os.path.join(folder, "content", "scripts", "solo.lua"),
        )
        if all(os.path.isfile(path) for path in required):
            result.append(name)
        else:
            print(f"Skipping {name}: missing RobloxApp_client.exe or content/scripts/solo.lua")
    return result


def register_client_archives(new_zips):
    catalog_path = os.path.join(OUT, "maps.json")
    if not os.path.isfile(catalog_path):
        raise SystemExit("Cannot use --clients-only without an existing site/data/maps.json")
    with open(catalog_path, encoding="utf-8") as fp:
        catalog = json.load(fp)
    catalog.setdefault("clientZips", {}).update(new_zips)
    temp = catalog_path + ".tmp"
    with open(temp, "w", encoding="utf-8") as fp:
        json.dump(catalog, fp, indent=1)
        fp.write("\\n")
    os.replace(temp, catalog_path)
    print(f"Registered {len(new_zips)} client archive(s), preserved {len(catalog.get('maps', []))} maps")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build RBXBanland client and map archives")
    parser.add_argument("--skip-root", action="store_true", help="Reuse existing Wine root.zip")
    parser.add_argument("--clients-only", action="store_true", help="Only rebuild/register staged clients; preserve existing maps")
    parser.add_argument("--client", action="append", help="Build a specific staged client (repeatable)")
    opts = parser.parse_args()
    os.makedirs(OUT, exist_ok=True)
    available = staged_clients()
    selected = list(dict.fromkeys(opts.client)) if opts.client else available
    if not selected:
        raise SystemExit("No compatible client directories found under clients/")
    invalid = [name for name in selected if name not in available]
    if invalid:
        raise SystemExit("Unstaged/unprepared clients: " + ", ".join(invalid))
    # No root rebuild is needed when only updating Novetus client overlays.
    if not opts.skip_root and not opts.clients_only:
        build_root()
    zips = {name: build_client(name) for name in selected}
    if opts.clients_only:
        register_client_archives(zips)
    else:
        # Full map rebuild requires every default mapped client to be staged.
        required = set(MAP_CLIENT.values())
        if not required.issubset(zips):
            raise SystemExit("Full map build needs: " + ", ".join(sorted(required - set(zips))) + "; use --clients-only")
        build_maps(zips)
'''

PLAY_LABEL_OLD = '''        <label class="Label">Screen
'''
PLAY_LABEL_NEW = '''        <label class="Label" title="Experimental: maps may be incompatible with other Roblox client versions">Client
          <select id="ClientSelect"><option value="">Loading...</option></select>
        </label>
        <label class="Label">Screen
'''
PLAY_AFTER_MAP_OLD = '''  document.getElementById("PlaceName").textContent = m.name;
'''
PLAY_AFTER_MAP_NEW = '''  document.getElementById("PlaceName").textContent = m.name;
  // Offer only client overlays that are actually present in the generated catalog.
  // Default remains the map's assigned version, so normal play is unchanged.
  const defaultClient = m.client || cat.client;
  const availableClients = cat.clientZips || {};
  const clientParam = RB.param("client");
  const clientName = Object.prototype.hasOwnProperty.call(availableClients, clientParam)
    ? clientParam : defaultClient;
  const clientSelect = document.getElementById("ClientSelect");
  clientSelect.replaceChildren(new Option(`Default (${defaultClient})`, ""));
  for (const id of Object.keys(availableClients).sort()) {
    clientSelect.append(new Option(id + (id === defaultClient ? " (recommended)" : " (experimental)"), id));
  }
  clientSelect.value = clientName === defaultClient && !clientParam ? "" : clientName;
  clientSelect.addEventListener("change", () => {
    const url = new URL(location.href);
    if (clientSelect.value) {
      url.searchParams.set("client", clientSelect.value);
      // Prefer the observed sharper player-exe path when testing other clients.
      url.searchParams.set("exe", "client");
    } else {
      url.searchParams.delete("client");
    }
    location.href = url.toString();
  });
'''
PLAY_CLIENT_OLD = '''  const clientName = m.client || cat.client;
'''
PLAY_CLIENT_NEW = '''  // clientName was selected above, with an allowlist from maps.json.
'''


def change_file(path, transformations, restore):
    backup = path.with_name(path.name + ".before-multiclient")
    if restore:
        if backup.exists():
            shutil.copy2(backup, path)
            print(f"Restored {path}")
        else:
            print(f"No backup for {path}")
        return
    original = path.read_text(encoding="utf-8")
    output = original
    for old, new in transformations:
        if new in output:
            continue
        if output.count(old) != 1:
            raise ValueError(f"Expected one anchor in {path}: {old[:80]!r}; found {output.count(old)}")
        output = output.replace(old, new, 1)
    if original == output:
        print(f"Already patched: {path}")
        return
    if not backup.exists():
        shutil.copy2(path, backup)
    path.write_text(output, encoding="utf-8")
    print(f"Patched {path} (backup: {backup.name})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, type=Path)
    ap.add_argument("--restore", action="store_true")
    args = ap.parse_args()
    root = args.root.expanduser().resolve()
    builder = root / "scripts" / "build_data.py"
    play = root / "site" / "play.html"
    for file in (builder, play):
        if not file.is_file():
            raise SystemExit(f"Missing file: {file}")
    patches = [
        (builder, [(BUILDER_OLD, BUILDER_NEW)]),
        (play, [(PLAY_LABEL_OLD, PLAY_LABEL_NEW),
                (PLAY_AFTER_MAP_OLD, PLAY_AFTER_MAP_NEW),
                (PLAY_CLIENT_OLD, PLAY_CLIENT_NEW)]),
    ]
    if not args.restore:
        # Validate all anchors in memory before making any modifications.
        for path, transformations in patches:
            data = path.read_text(encoding="utf-8")
            for old, new in transformations:
                if new not in data and data.count(old) != 1:
                    raise SystemExit(f"Unsupported file version: {path}, missing anchor {old[:50]!r}")
    for path, transformations in patches:
        change_file(path, transformations, args.restore)
    if not args.restore:
        print("Next: python3 scripts/build_data.py --skip-root --clients-only")


if __name__ == "__main__":
    main()
