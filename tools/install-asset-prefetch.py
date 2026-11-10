#!/usr/bin/env python3
"""Source-only guarded integration for 2x2 prefetch and legacy asset URL fixes.

Preview by default. Preserves local game maps, binaries, databases and API secrets.
"""
import argparse,datetime,pathlib,shutil,subprocess,tempfile,urllib.request
p=argparse.ArgumentParser()
p.add_argument('--root',type=pathlib.Path,default=pathlib.Path('D:/RBXBanland'))
p.add_argument('--apply',action='store_true')
a=p.parse_args();root=a.root.resolve()
if not (root/'server/lib/native.mjs').is_file():raise SystemExit('2x2 source checkout missing')
base='https://raw.githubusercontent.com/le-nt/2x2/feature/universal-roblox-asset-pipeline/'
new=['server/lib/native-asset-prefetch.mjs','tests/native-asset-prefetch.test.mjs']
updates={}
for rel in new:
 with urllib.request.urlopen(base+rel,timeout=20) as response:data=response.read(1024*1024+1)
 if not data or len(data)>1024*1024:raise SystemExit('Bad download: '+rel)
 dest=root/rel
 if dest.exists() and dest.read_bytes()!=data:raise SystemExit('Refusing to overwrite modified '+rel)
 if not dest.exists():updates[rel]=data

def patch(rel,fn):
 dest=root/rel
 if not dest.exists():raise SystemExit('File missing: '+rel)
 original=dest.read_text(encoding='utf-8-sig')
 changed=fn(original)
 if original!=changed:updates[rel]=changed.encode('utf-8')
 else:print('UNCHANGED:',rel)

def once(source,old,new):
 if new in source:return source
 if source.count(old)!=1:raise SystemExit('Unexpected local source: '+old[:75])
 return source.replace(old,new,1)

def native(s):
 s=once(s,
 "import {loadLegacyTextureMap,legacyTextureAssetId} from './legacy-texture-map.mjs';",
 "import {loadLegacyTextureMap,legacyTextureAssetId} from './legacy-texture-map.mjs';\nimport {createNativeAssetPrefetch} from './native-asset-prefetch.mjs';")
 s=once(s,
 " const legacyTextureIds=loadLegacyTextureMap(path.join(serverDir,'native/legacy-texture-ids.json'));",
 " const legacyTextureIds=loadLegacyTextureMap(path.join(serverDir,'native/legacy-texture-ids.json'));\n const assetPrefetch=createNativeAssetPrefetch({serverDir,assetResolver});")
 s=once(s,
 "   await preparePlace(id);\n   const result=await arbiter('/gameserver/new',{place_id:id});",
 "   await preparePlace(id);\n   // Prefetch only discovered missing IDs without blocking startup.\n   const classic=places.get(id)?.classic;\n   if(classic) assetPrefetch.launch(classic);\n   const result=await arbiter('/gameserver/new',{place_id:id});")
 return s
patch('server/lib/native.mjs',native)

def http(s):
 old='"http://roblox.com/asset/?", "https://roblox.com/asset/?"'
 new='"http://roblox.com/asset/?", "https://roblox.com/asset/?",\n            "http://www.projectpizza.net/api/asset?", "https://www.projectpizza.net/api/asset?",\n            "http://www.projectpizza.net/api/asset/?", "https://www.projectpizza.net/api/asset/?",\n            "http://projectpizza.net/api/asset?", "https://projectpizza.net/api/asset?",\n            "http://projectpizza.net/api/asset/?", "https://projectpizza.net/api/asset/?"'
 s=once(s,old,new)
 s=once(s,'return "/native/asset?id=" + id;','return "/native/content-asset?id=" + id;')
 return s
patch('services/engine/App/util/Emscripten/HttpPlatformImpl.cpp',http)
with tempfile.TemporaryDirectory(prefix='2x2-next-') as td:
 for rel,data in updates.items():
  staged=pathlib.Path(td)/rel
  staged.parent.mkdir(parents=True,exist_ok=True)
  staged.write_bytes(data)
  if rel.endswith('.mjs'):
   check=subprocess.run(['node','--check',str(staged)],capture_output=True,text=True)
   if check.returncode:raise SystemExit('Syntax validation failed: '+rel+' '+check.stderr)
 print('PREVIEW:',', '.join(updates) or 'already applied')
 if not a.apply:raise SystemExit('Preview only; no modifications. Pass --apply.')
 if not updates:raise SystemExit('Already installed.')
 backup=root/('backup-asset-prefetch-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
 backup.mkdir(exist_ok=False)
 applied=[]
 try:
  for rel,data in updates.items():
   dest=root/rel
   if dest.exists():
    saved=backup/rel;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,saved)
   dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);applied.append(rel)
 except Exception:
  for rel in reversed(applied):
   dest=root/rel;saved=backup/rel
   if saved.exists():shutil.copy2(saved,dest)
   else:dest.unlink(missing_ok=True)
  raise
 print('INSTALLED:',len(applied),'backup:',backup)
 print('TEST: node --test tests/native-asset-prefetch.test.mjs')
 print('NOTE: Native C++ change requires rebuilding your WSL engine and deploying updated WASM separately.')
