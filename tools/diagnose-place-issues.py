#!/usr/bin/env python3
"""Read-only diagnostics for Novetus maps not inventoried by 2x2.

It never edits maps, catalog IDs, or registries. Output contains no Lua source.
"""
import argparse
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

BAD = {'xml_parse_error','binary_needs_decoder','hash_mismatch','missing_file',
       'invalid_filename','too_large'}
SAFE = re.compile(r'(?:[a-f0-9]{64}|[a-z0-9-]+)\.rbxl\Z')

def run(root, output=None, all_places=False):
    root = Path(root).resolve()
    registry = json.loads((root/'server/native/places.json').read_text(encoding='utf8'))['places']
    catalog = json.loads((root/'site/data/maps.json').read_text(encoding='utf8'))['maps']
    by_id = {m['id']:m for m in catalog}
    cap_path = root/'site/data/place-capabilities.json'
    if not cap_path.is_file():
        raise FileNotFoundError('Run py tools\\build-place-manifests.py --root "C:\\RBXBanland" first')
    caps = json.loads(cap_path.read_text(encoding='utf8'))
    by_cap = {m['id']:m for m in caps.get('places',[])}
    rows=[]
    for ident,record in sorted(registry.items()):
        status=by_cap.get(ident,{}).get('status','not_scanned')
        if not all_places and status not in BAD and status != 'not_scanned':
            continue
        map_name=record.get('file','')
        safe=isinstance(map_name,str) and bool(SAFE.fullmatch(map_name))
        path=root/'server/native/maps'/map_name if safe else None
        present=bool(path and path.is_file())
        actual_size=path.stat().st_size if present else None
        manifest_path=root/'server/native/place-manifests'/(ident+'.json')
        manifest=json.loads(manifest_path.read_text(encoding='utf8')) if manifest_path.is_file() else {}
        public=by_id.get(ident,{})
        source=record.get('source',{})
        rows.append({
            'id':ident,'name':public.get('name',record.get('name',ident)),
            'year':public.get('year',''),'clientLabel':public.get('client',''),
            'status':status,'filePresent':present,'bytes':actual_size,
            'sourceFormat':source.get('format',''),
            'sourcePath':source.get('path',''),
            'parseError':manifest.get('parseMessage',manifest.get('error','')),
            'parseLine':manifest.get('parseLine',''),
            'parseColumn':manifest.get('parseColumn',''),
        })
    report={'totalRegistered':len(registry),'totalReported':len(rows),
            'statuses':dict(Counter(x['status'] for x in rows)),
            'note':'Diagnostic only; inventories do not establish browser playability.',
            'places':rows}
    if output:
        dest=Path(output).resolve()
        dest.parent.mkdir(parents=True,exist_ok=True)
        if dest.suffix.lower()=='.csv':
            with dest.open('w',encoding='utf-8-sig',newline='') as f:
                writer=csv.DictWriter(f,fieldnames=list(rows[0]) if rows else
                    ['id','name','year','clientLabel','status','filePresent','bytes','sourceFormat','sourcePath','parseError','parseLine','parseColumn'])
                writer.writeheader();writer.writerows(rows)
        else:
            dest.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    return report

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    p.add_argument('--out',type=Path,help='Optional report path (.json or .csv)')
    p.add_argument('--all',action='store_true',help='Include all places, not just exceptions')
    a=p.parse_args()
    result=run(a.root,a.out,a.all)
    print('Registered:',result['totalRegistered'],'| issues:',result['totalReported'])
    print('Statuses:',result['statuses'])
    for row in result['places']:
        print(f"{row['status']:22} {row['id']:48} {row['name'][:40]}")
        if row['parseError']:
            print('  ',row['parseError'],f"line={row['parseLine']} column={row['parseColumn']}")
    if a.out: print('Report saved:',a.out.resolve())

if __name__=='__main__': main()
