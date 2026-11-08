#!/usr/bin/env python3
"""Guarded source-only installer for the optional Open Cloud 2x2 asset pipeline.
Preview by default. Never modifies database, WASM, maps, or existing client files.
"""
import argparse, ast, datetime, pathlib, shutil, subprocess, tempfile, urllib.request

p=argparse.ArgumentParser()
p.add_argument('--root',type=pathlib.Path,default=pathlib.Path('D:/RBXBanland'))
p.add_argument('--apply',action='store_true')
a=p.parse_args()
root=a.root.resolve()
if not (root/'server/lib/asset-resolver.mjs').is_file(): raise SystemExit('2x2 source checkout not found')
branch='feature/universal-roblox-asset-pipeline'
url='https://raw.githubusercontent.com/le-nt/2x2/'+branch+'/'
new_files=['server/lib/roblox-open-cloud.mjs','tools/import-any-native.mjs',
           'tests/roblox-open-cloud.test.mjs','docs/UNIVERSAL-ROBLOX-ASSET-DELIVERY.md']
changes={}
for rel in new_files:
    with urllib.request.urlopen(url+rel,timeout=20) as response:
        data=response.read(1024*1024+1)
    if not data or len(data)>1024*1024:raise SystemExit('Bad download: '+rel)
    dest=root/rel
    if dest.exists() and dest.read_bytes()!=data:raise SystemExit('Refusing to overwrite existing '+rel)
    changes[rel]=data

def patch(rel,transform):
    dest=root/rel
    original=dest.read_text(encoding='utf-8-sig')
    changed=transform(original)
    if changed==original:
        print('ALREADY PATCHED:',rel)
    else:
        changes[rel]=changed.encode('utf-8')

def once(src,old,new):
    if new in src:return src
    if src.count(old)!=1:raise SystemExit('Unexpected local source; refusing to patch anchor '+old[:65])
    return src.replace(old,new,1)

def resolver(src):
    src=once(src,"import crypto from 'node:crypto';",
         "import crypto from 'node:crypto';\nimport {fetchRobloxOpenCloudAsset} from './roblox-open-cloud.mjs';")
    anchor="        if (!bytes && process.env.ROBLOX_ASSET_FETCH !== '0') {"
    addition="""        if (!bytes && process.env.ROBLOX_OPEN_CLOUD_API_KEY) {
          const cloud = await fetchRobloxOpenCloudAsset(id);
          if (cloud.bytes) bytes = cloud.bytes;
          else note('opencloud',cloud.reason);
        }
"""
    if addition not in src:src=once(src,anchor,addition+anchor)
    src=once(src,"/HTTP_401|HTTP_403/","/HTTP_401|HTTP_403|upstream_auth_required/")
    src=once(src,"/HTTP_404/","/HTTP_404|upstream_not_found/")
    return src
patch('server/lib/asset-resolver.mjs',resolver)

def seeder(src):
    return once(src,"const indexPath=path.join(nativeDir,'asset-index.json');",
         "const indexPath=path.join(nativeDir,opts.place ? 'asset-index.'+opts.place+'.json' : 'asset-index.json');")
patch('tools/seed-native-assets.mjs',seeder)

def importer(src):
    src=once(src,'import argparse,bz2,hashlib,json,re,zipfile',
                'import argparse,bz2,hashlib,json,re,zipfile,os,subprocess')
    src=once(src,'a=p.parse_args();root=a.root.resolve()',
       "p.add_argument('--skip-asset-seed',action='store_true');p.add_argument('--download-assets',action='store_true');a=p.parse_args();root=a.root.resolve()")
    tail="""
# Trigger asset discovery for all imported catalog maps.
if imported and not a.skip_asset_seed:
 cmd=['node',str(root/'tools/seed-native-assets.mjs'),'--root',str(root)]
 if a.download_assets or os.environ.get('ROBLOX_OPEN_CLOUD_API_KEY'):
  cmd+=['--download','--max-fetch','100']
 subprocess.run(cmd,cwd=root,check=True)
"""
    if tail.strip() not in src:src=src.rstrip()+ '\n'+tail
    return src
patch('tools/import-native.py',importer)

# Syntax check all generated source from a temporary staging directory.
with tempfile.TemporaryDirectory(prefix='2x2-asset-install-') as td:
    staging=pathlib.Path(td)
    for rel,data in changes.items():
        staged=staging/rel
        staged.parent.mkdir(parents=True,exist_ok=True)
        staged.write_bytes(data)
        if rel.endswith('.mjs'):
            cp=subprocess.run(['node','--check',str(staged)],capture_output=True,text=True)
            if cp.returncode:raise SystemExit(rel+' syntax check failed: '+cp.stderr)
        elif rel.endswith('.py'):
            ast.parse(data.decode('utf-8'))
    print('VALIDATED',len(changes),'files; preview:',', '.join(changes))
    if not a.apply:
        print('PREVIEW ONLY: nothing modified. Pass --apply to install.')
        raise SystemExit(0)
    backup=root/('backup-universal-assets-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(parents=True,exist_ok=False)
    installed=[]
    try:
        for rel,data in changes.items():
            dest=root/rel
            if dest.is_file():
                save=backup/rel
                save.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(dest,save)
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(data)
            installed.append(rel)
    except Exception:
        for rel in reversed(installed):
            dest=root/rel
            saved=backup/rel
            if saved.is_file():shutil.copy2(saved,dest)
            elif dest.exists():dest.unlink()
        raise
    print('INSTALLED',len(installed),'source files. Backup:',backup)
    print('Next: node --test tests/roblox-open-cloud.test.mjs tests/native-asset-seeder.test.mjs tests/asset-resolver.test.mjs tests/asset-upstream-errors.test.mjs')
