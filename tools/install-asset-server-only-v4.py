#!/usr/bin/env python3
"""2x2 server-only asset patch installer. Does not inspect or edit native C++.

Preview without --apply. Refuse unexpected locally modified files. Back up changes.
"""
import argparse
import datetime
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request

parser=argparse.ArgumentParser()
parser.add_argument('--root',type=Path,default=Path('D:/RBXBanland'))
parser.add_argument('--apply',action='store_true')
args=parser.parse_args()
root=args.root.resolve()
native=root/'server/lib/native.mjs'
if not native.is_file():
    raise SystemExit('Missing server/lib/native.mjs; check --root')
base='https://raw.githubusercontent.com/le-nt/2x2/feature/universal-roblox-asset-pipeline/'
files=[
 'server/lib/native-asset-prefetch.mjs',
 'server/lib/legacy-shared-assets.mjs',
 'tests/native-asset-prefetch.test.mjs',
 'tests/legacy-shared-assets.test.mjs',
 'tools/find-legacy-files.py',
 'tools/audit-native-place-scripts.py'
]
updates={}
for relative in files:
    with urllib.request.urlopen(base+relative,timeout=30) as response:
        data=response.read(1024*1024+1)
    if not data or len(data)>1024*1024:
        raise SystemExit('Invalid download: '+relative)
    destination=root/relative
    if destination.exists():
        if destination.read_bytes()!=data:
            raise SystemExit('Refusing overwrite of modified file: '+relative)
    else:
        updates[relative]=data

text=native.read_text(encoding='utf-8-sig')
original=text
server_patch_skipped=False
def insert_once(old,new):
    global text,server_patch_skipped
    if new in text:
        return
    if text.count(old)!=1:
        print('WARNING: server/lib/native.mjs source differs near:',old[:90])
        server_patch_skipped=True
        return
    text=text.replace(old,new,1)

insert_once(
 "import {loadLegacyTextureMap,legacyTextureAssetId} from './legacy-texture-map.mjs';",
 "import {loadLegacyTextureMap,legacyTextureAssetId} from './legacy-texture-map.mjs';\nimport {createNativeAssetPrefetch} from './native-asset-prefetch.mjs';"
)
insert_once(
 "import {createNativeAssetPrefetch} from './native-asset-prefetch.mjs';",
 "import {createNativeAssetPrefetch} from './native-asset-prefetch.mjs';\nimport {archiveRoots,findLegacyArchiveFile} from './legacy-shared-assets.mjs';"
)
insert_once(
 " const legacyTextureIds=loadLegacyTextureMap(path.join(serverDir,'native/legacy-texture-ids.json'));",
 " const legacyTextureIds=loadLegacyTextureMap(path.join(serverDir,'native/legacy-texture-ids.json'));\n const sharedRoots=archiveRoots(path.resolve(root,'..'));"
)
insert_once(
 " const sharedRoots=archiveRoots(path.resolve(root,'..'));",
 " const sharedRoots=archiveRoots(path.resolve(root,'..'));\n const assetPrefetch=createNativeAssetPrefetch({serverDir,assetResolver});"
)
insert_once(
 "   await preparePlace(id);\n   const result=await arbiter('/gameserver/new',{place_id:id});",
 "   await preparePlace(id);\n   const classic=places.get(id)?.classic;\n   if(classic) assetPrefetch.launch(classic);\n   const result=await arbiter('/gameserver/new',{place_id:id});"
)
insert_once(
 r"legacy-texture\/?$|content-asset",
 r"legacy-shared\/?$|legacy-texture\/?$|content-asset"
)
insert_once(
 "  }else if(p==='/native/legacy-texture'){",
 "  }else if(p==='/native/legacy-shared'){\n   file=findLegacyArchiveFile(sharedRoots,url.searchParams.get('path'));\n   kind=path.extname(file||'');\n  }else if(p==='/native/legacy-texture'){"
)
if server_patch_skipped:
    print('SKIPPED server/lib/native.mjs integration. Other tools and tests can still install.')
elif text!=original:
    updates['server/lib/native.mjs']=text.encode('utf-8')

with tempfile.TemporaryDirectory(prefix='2x2-server-install-') as temp:
    for relative,data in updates.items():
        staged=Path(temp)/relative
        staged.parent.mkdir(parents=True,exist_ok=True)
        staged.write_bytes(data)
        if relative.endswith('.mjs'):
            test=subprocess.run(['node','--check',str(staged)],capture_output=True,text=True)
            if test.returncode:
                raise SystemExit('Syntax error in '+relative+': '+test.stderr)
    print('Planned changes:',len(updates))
    for relative in updates:print(' -',relative)
    if not args.apply:
        print('PREVIEW ONLY: no changes made. Add --apply to install.')
        raise SystemExit(0)
    if not updates:
        print('Already installed; no changes made.')
        raise SystemExit(0)
    stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup=root/('backup-asset-server-'+stamp)
    backup.mkdir()
    installed=[]
    try:
        for relative,data in updates.items():
            destination=root/relative
            if destination.exists():
                old=backup/relative
                old.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(destination,old)
            destination.parent.mkdir(parents=True,exist_ok=True)
            destination.write_bytes(data)
            installed.append(relative)
    except Exception:
        for relative in reversed(installed):
            destination=root/relative
            old=backup/relative
            if old.exists():shutil.copy2(old,destination)
            else:destination.unlink(missing_ok=True)
        raise
    print('INSTALLED:',len(installed),'files')
    print('BACKUP:',backup)
    print('Test: node --test tests/native-asset-prefetch.test.mjs tests/legacy-shared-assets.test.mjs')
    print('C++ native routing was NOT modified. Native WASM must be rebuilt separately.')
