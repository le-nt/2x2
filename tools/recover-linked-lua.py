#!/usr/bin/env python3
"""Recover exact LinkedSource Lua IDs from Novetus's public assetdelivery cache.

Scans the registered XML place files, downloads only scripts/<ID>.lua entries
found in Novetus's verified GitHub tree, and never executes the source.
Does not edit the original places, active registry, client, or webserver.
"""
import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import os
import re
import tempfile
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('novetus_asset_import', BASE/'import-novetus-assets.py')
asset = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asset)
LINKED = re.compile(rb'<(?:Content|string)\b[^>]*\bname=["\x27]LinkedSource["\x27][^>]*>(.*?)</(?:Content|string)\s*>', re.I | re.S)
ASSET = re.compile(rb'(?:rbxassetid://|[?&](?:id|assetId)=)([1-9][0-9]{0,15})', re.I)
MAX_SCRIPT = 2_000_000
MAX_MAP = 200*1024*1024

def linked_ids(blob):
    """Read only explicit LinkedSource asset references, not arbitrary IDs."""
    result = set()
    for element in LINKED.findall(blob):
        for match in ASSET.finditer(element):
            result.add(match.group(1).decode('ascii'))
    return result

def gather(root, selected=None):
    reg = json.loads((root/'server/native/places.json').read_text('utf-8'))['places']
    if selected is not None and selected not in reg:
        raise ValueError('Unknown place: '+selected)
    maps = (root/'server/native/maps').resolve(strict=True)
    found = {}
    scanned = 0
    for name, row in reg.items():
        if selected is not None and name != selected:
            continue
        rel = row.get('file')
        if not isinstance(rel, str) or not rel.lower().endswith('.rbxl'):
            continue
        file = maps/rel
        if file.is_symlink() or not file.is_file() or not file.resolve().is_relative_to(maps):
            continue
        if file.stat().st_size > MAX_MAP:
            continue
        with file.open('rb') as stream:
            header = stream.read(1024)
            if b'<roblox' not in header:
                continue
            stream.seek(0)
            blob = stream.read(MAX_MAP+1)
        if len(blob) > MAX_MAP:
            continue
        scanned += 1
        for aid in linked_ids(blob):
            found.setdefault(aid, set()).add(name)
    return found, scanned

def download_one(row, source_dir):
    aid, meta = row
    destination = source_dir/(aid+'.lua')
    if destination.is_file() and not destination.is_symlink():
        return aid, 'already_cached', ''
    url = asset.RAW_BASE + meta['path']
    try:
        payload = asset.read_url(url, MAX_SCRIPT)
        if len(payload) != meta['bytes'] or asset.github_blob_sha(payload) != meta['sha']:
            raise ValueError('GitHub SHA/size verification failed')
        source = payload.decode('utf-8-sig')
        if not source.strip() or '\0' in source or source.lstrip().lower().startswith('<!doctype html'):
            raise ValueError('Not valid Lua text')
        source_dir.mkdir(parents=True, exist_ok=True)
        # O_EXCL: never clobber a cached user-supplied script.
        try:
            with destination.open('xb') as handle:
                handle.write(payload)
        except FileExistsError:
            return aid, 'already_cached', ''
        return aid, 'downloaded', ''
    except Exception as exc:
        return aid, 'failed', str(exc)[:180]

def recover(root, place=None, workers=4, limit=0, refresh=False):
    needed, scanned = gather(root, place)
    index, index_file = asset.load_tree(root, refresh)
    destination = root/'server/native/asset-recovery/scripts'
    candidates = {}
    for aid in needed:
        for item in index.get(aid, []):
            if item['path'] == 'scripts/'+aid+'.lua' and item['bytes'] <= MAX_SCRIPT:
                candidates[aid] = item
                break
    ordered = sorted(candidates.items(), key=lambda row:(-len(needed[row[0]]), int(row[0])))
    if limit:
        ordered = ordered[:limit]
    counts = Counter()
    records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for aid, status, reason in pool.map(lambda row:download_one(row,destination), ordered):
            counts[status] += 1
            if status == 'failed':
                records.append({'id':aid, 'error':reason})
    report = {
        'source':asset.REPOSITORY, 'scannedPlaces':scanned,
        'uniqueLinkedIds':len(needed),'matchedNovetusScripts':len(candidates),
        'selected':len(ordered),'counts':dict(counts),'errors':records,
        'cache':str(destination),'githubTree':str(index_file),
        'note':'Only exact LinkedSource IDs are downloaded and SHA-verified. Lua never runs in Python or Node.'
    }
    out=root/'server/native/asset-recovery/linked-script-recovery.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile('w',encoding='utf-8',dir=out.parent,delete=False) as tmp:
        json.dump(report,tmp,indent=2)
        staged=tmp.name
    os.replace(staged,out)
    return report

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=BASE.parent)
    ap.add_argument('--place')
    ap.add_argument('--workers',type=int,default=4)
    ap.add_argument('--limit',type=int,default=0,help='0 = all matching scripts')
    ap.add_argument('--refresh-index',action='store_true')
    args=ap.parse_args()
    if not 1<=args.workers<=8 or args.limit<0:
        ap.error('--workers must be 1..8, --limit must be nonnegative')
    print(json.dumps(recover(args.root.resolve(strict=True),args.place,args.workers,args.limit,args.refresh_index),indent=2))
