#!/usr/bin/env python3
"""Reuse Crossroads' proven empty-script repair pattern for matching legacy tools.

A conservative, opt-in bulk pass: never executes scripts, never replaces nonempty
sources, never changes original maps or the client launcher, and protects Crossroads.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import tempfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

VALID_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,150}\Z')
MAX_XML = 200 * 1024 * 1024


def name(item):
    props = item.find('Properties')
    if props is None:
        return ''
    return props.findtext("string[@name='Name']", '')


def all_items(root):
    return root.iter('Item')


def repaired_tree(data, source_map):
    """Returns modified XML only if exact Tool/Script matches are empty placeholders.

    Existing scripts are preserved, as is their Source, even if LinkedSource is set.
    """
    root = ET.fromstring(data)
    fixes = []
    skipped = Counter()
    for item in all_items(root):
        if item.get('class') != 'Tool':
            continue
        tool_name = name(item)
        templates = source_map.get(tool_name)
        if not templates:
            continue
        for child in item:
            if child.tag != 'Item' or child.get('class') not in ('Script', 'LocalScript'):
                continue
            script_name = name(child)
            source = templates.get(script_name)
            if not source:
                continue
            props = child.find('Properties')
            if props is None:
                skipped['noProperties'] += 1
                continue
            slots = [p for p in props if p.get('name') == 'Source']
            if len(slots) != 1 or slots[0].tag not in ('ProtectedString', 'string'):
                skipped['unrecognizedSourceSlot'] += 1
                continue
            if (slots[0].text or '').strip():
                skipped['workingSourcePreserved'] += 1
                continue
            slots[0].text = source
            for linked in [p for p in props if p.get('name') == 'LinkedSource']:
                linked.clear()
                linked.tag = 'Content'
                linked.set('name', 'LinkedSource')
                ET.SubElement(linked, 'null')
            fixes.append({'tool':tool_name,'script':script_name,'class':child.get('class')})
    if not fixes:
        return None, fixes, dict(skipped)
    payload = ET.tostring(root, encoding='utf-8', short_empty_elements=False)
    ET.fromstring(payload)
    return payload, fixes, dict(skipped)


def digest(blob):
    return hashlib.sha256(blob).hexdigest()


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix='.2x2-', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
        os.replace(tmp_name, path)
    finally:
        Path(tmp_name).unlink(missing_ok=True)


def run(root, activate=False, limit=None):
    native = root / 'server' / 'native'
    maps = native / 'maps'
    registry_file = native / 'places.json'
    registry = json.loads(registry_file.read_text(encoding='utf-8'))
    original = registry.get('places')
    if not isinstance(original, dict):
        raise ValueError('Expected places dictionary in registry')
    source_map = json.loads(Path(__file__).with_name('crossroads-tool-sources.json').read_text(encoding='utf-8'))
    output_dir = maps / '2x2-tool-repair'
    report_dir = native / 'asset-recovery'
    report_dir.mkdir(parents=True, exist_ok=True)
    results = []
    updates = {}
    counts = Counter()
    processed = 0
    for place_id, entry in sorted(original.items()):
        if limit is not None and processed >= limit:
            break
        if not isinstance(place_id,str) or not VALID_ID.fullmatch(place_id) or not isinstance(entry,dict):
            continue
        if 'crossroads' in place_id.lower():
            counts['protected_crossroads'] += 1
            continue
        rel = entry.get('file')
        if not isinstance(rel,str) or not rel.lower().endswith('.rbxl'):
            counts['not_xml'] += 1
            continue
        candidate = maps / rel
        try:
            # Do not follow symlinks or arbitrary registry paths.
            if candidate.is_symlink() or not candidate.is_file() or not candidate.resolve().is_relative_to(maps.resolve()):
                raise ValueError('missing or unsafe map path')
            if candidate.stat().st_size > MAX_XML:
                raise ValueError('XML exceeds size limit')
            blob = candidate.read_bytes()
            if b'<roblox' not in blob[:4096]:
                counts['not_xml'] += 1
                continue
            processed += 1
            converted, fixes, skipped = repaired_tree(blob, source_map)
            if not fixes:
                counts['no_matching_empty_scripts'] += 1
                continue
            dest_rel = f'2x2-tool-repair/{place_id}.rbxl'
            dest = maps / dest_rel
            if dest.exists():
                # Never overwrite an existing output with different bytes silently.
                if digest(dest.read_bytes()) != digest(converted):
                    raise ValueError('existing repaired copy differs; refusing overwrite')
            else:
                atomic_write(dest, converted)
            updates[place_id] = {'file':dest_rel, 'sha256':digest(converted)}
            counts['copies_created_or_reused'] += 1
            counts['scripts_restored'] += len(fixes)
            results.append({'id':place_id,'source':rel,'output':dest_rel,'restored':fixes,
                            'workingScriptsPreserved':skipped.get('workingSourcePreserved',0)})
        except (OSError,ValueError,ET.ParseError) as err:
            counts['skipped_with_error'] += 1
            results.append({'id':place_id,'error':str(err)[:250]})
    backup = None
    if activate and updates:
        # Registry activation is separate from conversion and backs up exact bytes.
        stamped = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        folder = report_dir / 'registry-backups'
        folder.mkdir(parents=True,exist_ok=True)
        backup = folder / f'places-before-tool-repair-{stamped}.json'
        shutil.copy2(registry_file, backup)
        for pid, changes in updates.items():
            registry['places'][pid].update(changes)
        atomic_write(registry_file, (json.dumps(registry,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
        counts['registry_entries_activated'] = len(updates)
    report = {'schemaVersion':1,'source':'Crossroads Universal tool script templates',
              'activationRequested':activate,'registryBackup':str(backup) if backup else None,
              'counts':dict(counts),'results':results,
              'note':'Exact tool/script matches only; scripts with nonempty Source are preserved. Other missing tool scripts need matching reference sources.'}
    atomic_write(report_dir/'bulk-linked-tool-repair.json',(json.dumps(report,indent=2)+'\n').encode())
    return report


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(r'C:\RBXBanland'))
    p.add_argument('--activate',action='store_true',help='Switch registry to generated copies after backup')
    p.add_argument('--limit',type=int,default=None)
    a = p.parse_args()
    root = a.root.resolve(strict=True)
    output = run(root, a.activate, a.limit)
    print(json.dumps({'counts':output['counts'],'registryBackup':output['registryBackup'],
                      'report':str(root/'server/native/asset-recovery/bulk-linked-tool-repair.json')},indent=2))


if __name__ == '__main__':
    main()
