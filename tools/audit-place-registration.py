#!/usr/bin/env python3
"""Read-only validation of 2x2 catalog, native registry and capability manifest coverage."""
import argparse
import json
import re
from pathlib import Path
from collections import Counter

SAFE_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,150}$')
SAFE_MAP = re.compile(r'^(?:[a-f0-9]{64}|[a-z0-9-]+)\.rbxl$')

def audit(root):
    catalog = json.loads((root/'site/data/maps.json').read_text(encoding='utf8'))['maps']
    registry = json.loads((root/'server/native/places.json').read_text(encoding='utf8'))['places']
    inventory_path = root/'site/data/place-capabilities.json'
    inventory = json.loads(inventory_path.read_text(encoding='utf8')).get('places', []) if inventory_path.exists() else []
    ids = [entry.get('id') for entry in catalog]
    dupes = sorted(x for x, n in Counter(ids).items() if n>1)
    native_ids = [record.get('id') for record in registry.values()]
    duplicate_native = sorted(str(x) for x,n in Counter(native_ids).items() if n>1)
    malformed = sorted(x for x in registry if not SAFE_ID.fullmatch(x))
    invalid_files = sorted(x for x,r in registry.items() if not isinstance(r.get('file'),str) or not SAFE_MAP.fullmatch(r['file']))
    inventory_ids = {p['id'] for p in inventory if isinstance(p,dict) and isinstance(p.get('id'),str)}
    registered = set(registry)
    catalog_ids = set(ids)
    source_linked = sum(1 for item in catalog if isinstance(item.get('source'), dict) and item['source'].get('repository') == 'Novetus/Novetus-Map-Pack')
    report = {
        'catalogCount':len(catalog),'nativeCount':len(registry),'manifestCount':len(inventory),
        'novetusLinkedCatalogCount':source_linked,
        'catalogIdsWithoutNative':sorted(catalog_ids-registered),
        'nativeIdsWithoutCatalog':sorted(registered-catalog_ids),
        'nativeIdsWithoutManifest':sorted(registered-inventory_ids),
        'manifestIdsWithoutNative':sorted(inventory_ids-registered),
        'duplicateCatalogIds':dupes,'duplicateNativeIds':duplicate_native,
        'unsafeRegistryIds':malformed,'invalidMapFilenames':invalid_files,
        'manifestStatuses':dict(Counter(p.get('status','unknown') for p in inventory)),
    }
    return report

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument('--json', action='store_true')
    args=ap.parse_args()
    result=audit(args.root.resolve())
    if args.json: print(json.dumps(result,indent=2))
    else:
        for k,v in result.items():
            if isinstance(v,list): print(f'{k}: {len(v)}' + (f' (first 8: {v[:8]})' if v else ''))
            else:print(f'{k}: {v}')
    if result['duplicateCatalogIds'] or result['duplicateNativeIds'] or result['invalidMapFilenames'] or result['unsafeRegistryIds']:
        raise SystemExit(2)
if __name__=='__main__':main()
