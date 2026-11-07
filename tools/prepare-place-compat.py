#!/usr/bin/env python3
"""Offline/read-only compatibility preparation for registered 2x2 XML places.

Never executes Lua, downloads content, alters places, or changes the browser launcher.
Produces JSON reports only when --write is passed.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from collections import Counter
from pathlib import Path

SAFE_ID = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,150}\Z")
ASSET_ID = re.compile(r"[1-9][0-9]{0,15}\Z")
EXTENSIONS = ('.rbxm','.rbxmx','.mesh','.png','.jpg','.jpeg','.dds','.wav','.mp3','.ogg','.txt')
MAX_ASSET_SIZE = 64 * 1024 * 1024
VALID_STATUSES = {'inventoried','inventoried_with_xml_recovery'}

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def atomic_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, tmp = tempfile.mkstemp(prefix=path.name+'.',suffix='.tmp',dir=path.parent)
    try:
        with os.fdopen(handle,'w',encoding='utf-8') as f:
            json.dump(payload,f,indent=2,ensure_ascii=False)
            f.write('\n')
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

def safe_existing_asset(directory, filename):
    """Only return regular files genuinely below an allowed root."""
    try:
        root=directory.resolve(strict=True)
        file=(root / filename).resolve(strict=True)
        if not file.is_relative_to(root) or not file.is_file():
            return None
        if file.stat().st_size > MAX_ASSET_SIZE:
            return None
        return file
    except (OSError, ValueError):
        return None

def find_asset(root, asset_id):
    """Match the exact lookup order of Phase 8's local numeric resolver."""
    if not isinstance(asset_id,str) or not ASSET_ID.fullmatch(asset_id):
        return None
    roots=((root/'server/native/asset-library',''),(root/'site/data/scenes/assets','assets_'))
    for folder,prefix in roots:
        for ext in EXTENSIONS:
            candidate=safe_existing_asset(folder,prefix+asset_id+ext)
            if candidate:
                return candidate.relative_to(root).as_posix()
    return None

def prepare_one(root, place_id, entry, manifest, client_label=None):
    status=manifest.get('status')
    assets=manifest.get('assetIds',[])
    scripts=manifest.get('scripts',[])
    tools=manifest.get('tools',[])
    if not isinstance(assets,list) or not isinstance(scripts,list) or not isinstance(tools,list):
        raise ValueError(f'Invalid manifest collections: {place_id}')
    resolved=[];missing=[];invalid=[]
    if status in VALID_STATUSES:
        for asset_id in sorted(set(assets),key=str):
            if not isinstance(asset_id,str) or not ASSET_ID.fullmatch(asset_id):
                invalid.append(str(asset_id))
                continue
            path=find_asset(root,asset_id)
            (resolved if path else missing).append({'id':asset_id,**({'path':path} if path else {})})
    registry_file=entry.get('file','')
    warnings=[]
    if status not in VALID_STATUSES:
        warnings.append('Inventory unavailable or incomplete; no playable-package claim is possible.')
    if missing:
        warnings.append('Missing local numeric assets: an HTTP route alone cannot supply their bytes.')
    if scripts:
        warnings.append('Script presence is known, but Lua API/version compatibility and execution are unverified.')
    if tools:
        warnings.append('Tool presence is known, but handle, joints, activation, and replication are unverified.')
    if manifest.get('status')=='inventoried_with_xml_recovery':
        warnings.append('XML recovery was used during inventory; original place file was not modified.')
    client=client_label or entry.get('client') or 'Native'
    return {
        'schemaVersion':1,'placeId':place_id,'nativeId':entry.get('id'),'clientLabel':client,
        'sourcePlaceFile':registry_file,'originalSha256':entry.get('sha256'),
        'inventoryStatus':status,'prepared':status in VALID_STATUSES,
        'scripts':{'count':len(scripts),'server':sum(s.get('class')=='Script' for s in scripts),
                   'local':sum(s.get('class')=='LocalScript' for s in scripts),
                   'modules':sum(s.get('class')=='ModuleScript' for s in scripts)},
        'tools':{'count':len(tools),'withEmbeddedScripts':len({s.get('containerTool') for s in scripts if s.get('containerTool')})},
        'assets':{'referenced':len(assets),'resolved':resolved,'missing':missing,'invalid':invalid},
        'compatibility':{'engineScriptsVerified':False,'toolsVerified':False,'meshesConverted':False,
                         'clientCompatible':None,'launchReady':None},
        'warnings':warnings,
    }

def build(root,place=None,limit=None,write=False):
    root=Path(root).resolve()
    registry=load(root/'server/native/places.json')['places']
    catalog_path=root/'site/data/maps.json'
    catalog={r['id']:r for r in load(catalog_path).get('maps',[])} if catalog_path.is_file() else {}
    selected=[place] if place else sorted(registry)
    if place and (not SAFE_ID.fullmatch(place) or place not in registry):
        raise ValueError('Place ID not in local registry')
    if limit is not None:
        if limit < 0:raise ValueError('limit must be nonnegative')
        selected=selected[:limit]
    reports=[];tally=Counter()
    for place_id in selected:
        if not SAFE_ID.fullmatch(place_id):
            raise ValueError('Unsafe place ID in registry')
        manifest_file=root/'server/native/place-manifests'/(place_id+'.json')
        if not manifest_file.is_file():
            tally['missing_manifest']+=1
            continue
        manifest=load(manifest_file)
        if manifest.get('id') != place_id:
            raise ValueError(f'Mismatched manifest identity: {place_id}')
        report=prepare_one(root,place_id,registry[place_id],manifest,catalog.get(place_id,{}).get('client'))
        reports.append(report)
        tally[report['inventoryStatus'] or 'unknown']+=1
        if write:
            atomic_json(root/'server/native/compat-prepared'/(place_id+'.json'),report)
    summary={'schemaVersion':1,'mode':'write' if write else 'dry-run',
             'selected':len(selected),'preparedReports':len(reports),
             'statuses':dict(tally),
             'assetsResolved':sum(len(r['assets']['resolved']) for r in reports),
             'assetsMissing':sum(len(r['assets']['missing']) for r in reports),
             'scriptsDetected':sum(r['scripts']['count'] for r in reports),
             'toolsDetected':sum(r['tools']['count'] for r in reports),
             'note':'Offline compatibility metadata only. No Lua/mesh conversion, downloads, or launch modifications.'}
    if write:
        atomic_json(root/'server/native/compat-prepared/index.json',summary)
    return summary,reports

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument('--place',help='Catalog ID of one place (try Crossroads first)')
    ap.add_argument('--limit',type=int)
    ap.add_argument('--write',action='store_true',help='Write reports under server/native/compat-prepared')
    args=ap.parse_args()
    try:
        summary,reports=build(args.root,args.place,args.limit,args.write)
    except (OSError,ValueError,KeyError,json.JSONDecodeError) as e:
        print('ERROR:',e,file=sys.stderr);return 1
    print(json.dumps(summary,indent=2))
    if args.place and reports:
        print('Place report:',json.dumps(reports[0],indent=2))
    return 0

if __name__=='__main__':raise SystemExit(main())
