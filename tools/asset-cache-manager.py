#!/usr/bin/env python3
"""Offline asset dependency rollup and safe cache import for 2x2.

Does not alter runtime, launch files, place archives or source Lua.
"""
import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

ASSET_ID=re.compile(r'[1-9][0-9]{0,15}\Z')
EXTS={'.mesh','.rbxm','.rbxmx','.png','.jpg','.jpeg','.dds','.wav','.mp3','.ogg','.txt'}
LIMIT=64*1024*1024

def summarize(root):
    source=root/'server/native/compat-prepared'
    if not source.is_dir():
        raise ValueError('Missing compat-prepared reports: run prepare-place-compat.py --write first')
    needs=defaultdict(set);have=defaultdict(set);invalid=[];count=0
    for p in sorted(source.glob('*.json')):
        if p.name=='index.json':continue
        d=json.loads(p.read_text(encoding='utf-8'))
        place=d.get('placeId')
        if not isinstance(place,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,150}',place):
            raise ValueError('Unsafe place ID: '+p.name)
        if p.stem!=place:raise ValueError('Report/file identity mismatch: '+p.name)
        if not d.get('prepared'):continue  # excludes binary inventory errors
        count+=1
        for kind,target in [('missing',needs),('resolved',have)]:
            for row in d.get('assets',{}).get(kind,[]):
                aid=row.get('id')
                if isinstance(aid,str) and ASSET_ID.fullmatch(aid):target[aid].add(place)
                else:invalid.append({'placeId':place,'id':str(aid)})
    rows=[{'id':aid,'placesNeeding':len(places),'examplePlaces':sorted(places)[:5]}
          for aid,places in needs.items()]
    rows.sort(key=lambda r:(-r['placesNeeding'],int(r['id'])))
    return {'schemaVersion':1,'placesAnalyzed':count,'missingReferences':sum(len(v) for v in needs.values()),
            'uniqueMissingIds':len(needs),'uniqueResolvedIds':len(have),
            'invalidIds':invalid,'assets':rows}

def save_rollup(root,report):
    out=root/'server/native/asset-recovery';out.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile('w',encoding='utf-8',dir=out,delete=False,suffix='.tmp') as f:
        json.dump(report,f,indent=2);f.write('\n');temp=f.name
    os.replace(temp,out/'missing-assets.json')
    with tempfile.NamedTemporaryFile('w',encoding='utf-8',newline='',dir=out,delete=False,suffix='.tmp') as f:
        w=csv.writer(f);w.writerow(['assetId','placesNeeding','examplePlaces'])
        for row in report['assets']:w.writerow([row['id'],row['placesNeeding'],';'.join(row['examplePlaces'])])
        temp=f.name
    os.replace(temp,out/'missing-assets.csv')
    return out

def is_unsafe(path,base):
    resolved=path.resolve()
    return not resolved.is_relative_to(base.resolve())

def import_dir(root,source,dry_run=True):
    root=root.resolve();source=source.resolve(strict=True)
    cache=root/'server/native/asset-library'
    if source==cache or source.is_relative_to(cache) or cache.is_relative_to(source):
        raise ValueError('Source directory must be separate from the asset library')
    if not source.is_dir():raise ValueError('Asset source is not a directory')
    result={'mode':'dry-run' if dry_run else 'import','candidateFiles':0,'imported':0,
            'alreadyPresent':0,'nameConflicts':0,'rejected':0,'bytesImported':0,'samples':[]}
    files=sorted(source.iterdir())  # explicit flat folder only, no recursive surprises
    for file in files:
        if file.is_symlink() or not file.is_file() or is_unsafe(file,source):
            result['rejected']+=1;continue
        if not ASSET_ID.fullmatch(file.stem) or file.suffix.lower() not in EXTS:
            result['rejected']+=1;continue
        size=file.stat().st_size
        if size==0 or size>LIMIT:
            result['rejected']+=1;continue
        result['candidateFiles']+=1
        name=file.stem+file.suffix.lower();dest=cache/name
        # Compare bytes by streaming hash; don't replace existing cache entries.
        if dest.exists() or dest.is_symlink():
            if dest.is_symlink() or not dest.is_file():result['nameConflicts']+=1;continue
            def sha(p):
                h=hashlib.sha256()
                with p.open('rb') as f:
                    for buf in iter(lambda:f.read(1024*1024),b''):h.update(buf)
                return h.digest()
            result['alreadyPresent' if sha(file)==sha(dest) else 'nameConflicts']+=1
            continue
        if not dry_run:
            cache.mkdir(parents=True,exist_ok=True)
            # Exclusive creation prevents an accidental overwrite.
            try:
                with dest.open('xb') as out, file.open('rb') as inp:
                    shutil.copyfileobj(inp,out,1024*1024)
            except FileExistsError:
                result['nameConflicts']+=1;continue
            except Exception:
                dest.unlink(missing_ok=True);raise
        result['imported']+=1;result['bytesImported']+=size
        if len(result['samples'])<12:result['samples'].append(name)
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    p.add_argument('--report',action='store_true',help='Write a deduplicated missing asset report')
    p.add_argument('--import-from',type=Path,help='Directory of existing asset files named 12345.mesh, 12345.png, etc')
    p.add_argument('--apply',action='store_true',help='Actually copy cache imports; otherwise dry-run')
    a=p.parse_args()
    try:
        if a.apply and not a.import_from:raise ValueError('--apply requires --import-from')
        if a.import_from:
            print(json.dumps(import_dir(a.root,a.import_from,not a.apply),indent=2))
        else:
            report=summarize(a.root)
            if a.report:print('Report directory:',save_rollup(a.root,report))
            print(json.dumps({k:v for k,v in report.items() if k not in ('assets','invalidIds')},indent=2))
            print('Top missing asset IDs:',json.dumps(report['assets'][:15],indent=2))
    except (ValueError,OSError,KeyError,json.JSONDecodeError) as e:
        print('ERROR:',e,file=sys.stderr);return 1
    return 0
if __name__=='__main__':raise SystemExit(main())
