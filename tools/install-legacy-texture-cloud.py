#!/usr/bin/env python3
"""Install verified legacy texture Cloud fallback into a locally modified 2x2 checkout.
Preview unless --apply; make backups; never touch maps, WASM, keys or databases.
"""
import argparse, datetime, pathlib, shutil, subprocess, tempfile, urllib.request
p=argparse.ArgumentParser()
p.add_argument('--root',type=pathlib.Path,default=pathlib.Path('D:/RBXBanland'))
p.add_argument('--apply',action='store_true')
a=p.parse_args()
root=a.root.resolve()
rel='server/lib/native.mjs'
native=root/rel
if not native.is_file():raise SystemExit('Native server file missing in '+str(root))
base='https://raw.githubusercontent.com/le-nt/2x2/feature/universal-roblox-asset-pipeline/'
updates={}
for relfile in ['server/lib/legacy-texture-map.mjs','tests/legacy-texture-map.test.mjs']:
 with urllib.request.urlopen(base+relfile,timeout=20) as response:
  data=response.read(1024*1024+1)
 if not data or len(data)>1024*1024:raise SystemExit('Invalid download '+relfile)
 dest=root/relfile
 if dest.exists() and dest.read_bytes()!=data:raise SystemExit('Refusing to overwrite modified '+relfile)
 if not dest.exists():updates[relfile]=data

original=native.read_text(encoding='utf-8-sig')
source=original
def once(old,new):
 global source
 if new in source:return
 if source.count(old)!=1:raise SystemExit('Unexpected local native.mjs layout; refusing anchor '+old[:80])
 source=source.replace(old,new,1)
once("import {inspectAvatarDependencies} from './native-avatar-deps.mjs';",
     "import {inspectAvatarDependencies} from './native-avatar-deps.mjs';\nimport {loadLegacyTextureMap,legacyTextureAssetId} from './legacy-texture-map.mjs';")
once(" const engineTexturesRoot=path.join(root,'../services/engine/.assets/content/textures');",
     " const engineTexturesRoot=path.join(root,'../services/engine/.assets/content/textures');\n const legacyTextureIds=loadLegacyTextureMap(path.join(serverDir,'native/legacy-texture-ids.json'));")
old="""   if(/^[A-Za-z0-9_-]+\\.(?:png|jpe?g|dds)$/i.test(name||'')){
    file=beneath(legacyTexturesRoot,name) ||
         beneath(engineTexturesRoot,name);
    kind=path.extname(file||'');
   }"""
new="""   if(/^[A-Za-z0-9_-]+\\.(?:png|jpe?g|dds)$/i.test(name||'')){
    file=beneath(legacyTexturesRoot,name) ||
         beneath(engineTexturesRoot,name);
    kind=path.extname(file||'');
    // Only use Cloud when a verified numeric ID is explicitly mapped.
    if(!file){
     const mapped=legacyTextureAssetId(name,legacyTextureIds);
     if(mapped){const asset=await assetResolver?.resolve(mapped);if(asset){file=asset.file;kind=asset.ext;}}
    }
   }"""
once(old,new)
if source!=original:updates[rel]=source.encode('utf8')
with tempfile.TemporaryDirectory(prefix='2x2-legacy-texture-') as t:
 for relfile,data in updates.items():
  dest=pathlib.Path(t)/relfile
  dest.parent.mkdir(parents=True,exist_ok=True)
  dest.write_bytes(data)
  if dest.suffix=='.mjs':
   result=subprocess.run(['node','--check',str(dest)],capture_output=True,text=True)
   if result.returncode:raise SystemExit('Syntax check failed '+relfile+': '+result.stderr)
 print('PREVIEW:',', '.join(updates) or 'already installed')
 if not a.apply:raise SystemExit('No changes made. Add --apply to install.')
 if not updates:raise SystemExit('Already installed.')
 backup=root/('backup-legacy-texture-cloud-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
 backup.mkdir(exist_ok=False)
 installed=[]
 try:
  for relfile,data in updates.items():
   dest=root/relfile
   if dest.exists():
    olddest=backup/relfile
    olddest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(dest,olddest)
   dest.parent.mkdir(parents=True,exist_ok=True)
   dest.write_bytes(data)
   installed.append(relfile)
 except Exception:
  for relfile in reversed(installed):
   dest=root/relfile
   saved=backup/relfile
   if saved.exists():shutil.copy2(saved,dest)
   else:dest.unlink(missing_ok=True)
  raise
 print('INSTALLED:',len(installed),'files; backup:',backup)
 print('TEST: node --test tests/legacy-texture-map.test.mjs')
