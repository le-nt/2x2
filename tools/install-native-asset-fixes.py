#!/usr/bin/env python3
"""Guarded installer for 2x2 native asset source fixes.

Preview by default; never touches WebAssembly, compiled client, maps, user DB, or keys.
"""
import argparse, datetime, pathlib, shutil, subprocess, tempfile, urllib.request

p=argparse.ArgumentParser()
p.add_argument('--root',type=pathlib.Path,default=pathlib.Path('D:/RBXBanland'))
p.add_argument('--apply',action='store_true')
a=p.parse_args()
root=a.root.resolve()
if not (root/'server/lib/native.mjs').is_file():raise SystemExit('2x2 checkout not found')
base='https://raw.githubusercontent.com/le-nt/2x2/feature/universal-roblox-asset-pipeline/'
new=[
 'server/lib/native-asset-prefetch.mjs',
 'server/lib/legacy-shared-assets.mjs',
 'tests/native-asset-prefetch.test.mjs',
 'tests/legacy-shared-assets.test.mjs',
 'tools/find-legacy-files.py',
 'tools/audit-native-place-scripts.py'
]
updates={}
for rel in new:
 with urllib.request.urlopen(base+rel,timeout=20) as r:data=r.read(1024*1024+1)
 if not data or len(data)>1024*1024:raise SystemExit('Invalid download: '+rel)
 dest=root/rel
 if dest.exists() and dest.read_bytes()!=data:raise SystemExit('Will not overwrite locally modified '+rel)
 if not dest.exists():updates[rel]=data

def once(src,old,new):
 if new in src:return src
 if src.count(old)!=1:raise SystemExit('Local source anchor mismatch: '+old[:75])
 return src.replace(old,new,1)

def patch(rel,fn):
 file=root/rel
 if not file.is_file():raise SystemExit('File missing: '+rel)
 src=file.read_text(encoding='utf-8-sig')
 result=fn(src)
 if result!=src:updates[rel]=result.encode('utf8')
 else:print('UNCHANGED:',rel)

def native(s):
 s=once(s,
  "import {loadLegacyTextureMap,legacyTextureAssetId} from './legacy-texture-map.mjs';",
  "import {loadLegacyTextureMap,legacyTextureAssetId} from './legacy-texture-map.mjs';\nimport {createNativeAssetPrefetch} from './native-asset-prefetch.mjs';")
 s=once(s,
  "import {createNativeAssetPrefetch} from './native-asset-prefetch.mjs';",
  "import {createNativeAssetPrefetch} from './native-asset-prefetch.mjs';\nimport {archiveRoots,findLegacyArchiveFile} from './legacy-shared-assets.mjs';")
 s=once(s,
  " const legacyTextureIds=loadLegacyTextureMap(path.join(serverDir,'native/legacy-texture-ids.json'));",
  " const legacyTextureIds=loadLegacyTextureMap(path.join(serverDir,'native/legacy-texture-ids.json'));\n const sharedRoots=archiveRoots(path.resolve(root,'..'));")
 s=once(s,
  " const sharedRoots=archiveRoots(path.resolve(root,'..'));",
  " const sharedRoots=archiveRoots(path.resolve(root,'..'));\n const assetPrefetch=createNativeAssetPrefetch({serverDir,assetResolver});")
 s=once(s,
  "   await preparePlace(id);\n   const result=await arbiter('/gameserver/new',{place_id:id});",
  "   await preparePlace(id);\n   // Nonblocking prefetch of known missing assets on game launch.\n   const classic=places.get(id)?.classic;\n   if(classic) assetPrefetch.launch(classic);\n   const result=await arbiter('/gameserver/new',{place_id:id});")
 s=once(s,
  r"legacy-texture\/?$|content-asset",
  r"legacy-shared\/?$|legacy-texture\/?$|content-asset")
 s=once(s,
  "  }else if(p==='/native/legacy-texture'){",
  "  }else if(p==='/native/legacy-shared'){\n   file=findLegacyArchiveFile(sharedRoots,url.searchParams.get('path'));\n   kind=path.extname(file||'');\n  }else if(p==='/native/legacy-texture'){")
 return s
patch('server/lib/native.mjs',native)

def cpp(s):
 s=once(s,
  '            "http://roblox.com/asset/?", "https://roblox.com/asset/?"',
  '            "http://roblox.com/asset/?", "https://roblox.com/asset/?",\n'
  '            "http://www.projectpizza.net/api/asset?", "https://www.projectpizza.net/api/asset?",\n'
  '            "http://www.projectpizza.net/api/asset/?", "https://www.projectpizza.net/api/asset/?",\n'
  '            "http://projectpizza.net/api/asset?", "https://projectpizza.net/api/asset?",\n'
  '            "http://projectpizza.net/api/asset/?", "https://projectpizza.net/api/asset/?"')
 s=once(s,'return "/native/asset?id=" + id;','return "/native/content-asset?id=" + id;')
 return s
patch('services/engine/App/util/Emscripten/HttpPlatformImpl.cpp',cpp)

def content(s):
 # This helper was deployed in multiple 2x2 builds. Treat any already-present
 # legacy-shared route as applied; don't depend on whitespace or exact comments.
 if 'route = "legacy-shared?path=";' in s:
  print('ALREADY PATCHED: ContentProvider legacy-shared route')
  return s
 import re
 pattern=(r'(else\s+if\s*\(\s*lowerRelative\.compare\(0,\s*texture\.size\(\),\s*texture\)\s*==\s*0\s*\)'
          r'\s*\{\s*route\s*=\s*"legacy-texture\?name=";\s*name\s*=\s*relative\.substr\(texture\.size\(\)\);\s*\})'
          r'(\s*else\s+return\s+false;)')
 matches=list(re.finditer(pattern,s))
 if len(matches)!=1:
  raise SystemExit('Local ContentProvider layout differs; no files modified. Paste the redirectLegacySharedFileToBase function for a targeted patch.')
 addition=("""
        else if (lowerRelative.compare(0, 11, "shareddata/") == 0)
        {
            // Resolve archived relative files from approved local archive roots.
            route = "legacy-shared?path=";
            name = relative.substr(11);
        }""")
 m=matches[0]
 return s[:m.start()]+m.group(1)+addition+m.group(2)+s[m.end():]
patch('services/engine/App/util/ContentProvider.cpp',content)

with tempfile.TemporaryDirectory(prefix='2x2-native-asset-') as tmp:
 for rel,data in updates.items():
  staged=pathlib.Path(tmp)/rel;staged.parent.mkdir(parents=True,exist_ok=True);staged.write_bytes(data)
  if rel.endswith('.mjs'):
   cp=subprocess.run(['node','--check',str(staged)],capture_output=True,text=True)
   if cp.returncode:raise SystemExit('Node syntax failed for '+rel+': '+cp.stderr)
 print('PREVIEW:',', '.join(updates) or 'already installed')
 if not a.apply:raise SystemExit('No changes made; use --apply')
 if not updates:raise SystemExit('Already installed')
 backup=root/('backup-native-asset-fixes-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
 backup.mkdir(exist_ok=False)
 installed=[]
 try:
  for rel,data in updates.items():
   dest=root/rel
   if dest.exists():
    saved=backup/rel;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,saved)
   dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);installed.append(rel)
 except Exception:
  for rel in reversed(installed):
   dest=root/rel;saved=backup/rel
   if saved.exists():shutil.copy2(saved,dest)
   else:dest.unlink(missing_ok=True)
  raise
 print('INSTALLED',len(installed),'files; backup:',backup)
 print('Run: node --test tests/native-asset-prefetch.test.mjs tests/legacy-shared-assets.test.mjs')
 print('Recompile UniversalClient in WSL before C++ changes affect the browser.')
