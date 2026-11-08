#!/usr/bin/env python3
"""Find missing legacy shareddata resources in local 2x2/archive folders.

Read-only. Scans only explicitly selected roots and known 2x2 archive folders;
does not traverse filesystem root, follow symlink directories, or contact servers.
"""
import argparse, collections, json, os
from pathlib import Path

WANTED = [
 'Shotgun.mesh','pistol.mesh','Shotgun.png','pistol.png',
 'pistol_icon.png','shotgun_icon.png','Rocketboots.png',
 'SpawnLocation.png','redsky512_rt.png','redsky512_up.png',
 'redsky512_bk.png','redsky512_lf.png','redsky512_dn.png','redsky512_ft.png',
 'cake.png','easteregg.png','bluevortex.png','vortex.png','Disappear.png',
 'Rocket whoosh 01.wav'
]
parser=argparse.ArgumentParser()
parser.add_argument('--project',type=Path,default=Path('D:/RBXBanland'))
parser.add_argument('--root',type=Path,action='append',default=[],help='Additional archive root; repeat as needed')
parser.add_argument('--max-files',type=int,default=150000)
a=parser.parse_args()
project=a.project.resolve()
roots=[project/'clients',project/'services'/'engine'/'.assets',project/'site',
       project/'server'/'native',*a.root]
roots=[p.resolve() for p in roots if p.is_dir()]
if a.max_files<100 or a.max_files>2_000_000:parser.error('--max-files outside bounds')
found=collections.defaultdict(list)
wanted={name.casefold() for name in WANTED}
scanned=0
for root in roots:
 print('Scanning:',root,flush=True)
 for where,dirs,files in os.walk(root,followlinks=False):
  dirs[:]=[d for d in dirs if not (Path(where)/d).is_symlink() and d not in {'.git','node_modules','build','backup'}]
  for name in files:
   scanned+=1
   if name.casefold() in wanted:
    full=Path(where)/name
    try: rel=full.relative_to(root)
    except ValueError: continue
    found[name.casefold()].append({'path':str(full),'relativeToScanRoot':rel.as_posix()})
   if scanned>=a.max_files:break
  if scanned>=a.max_files:break
 if scanned>=a.max_files:break
print(json.dumps({'scannedFiles':scanned,'roots':[str(r) for r in roots],
 'matches':{name:found.get(name.casefold(),[]) for name in WANTED},
 'note':'Set RBX_LEGACY_SHARED_ROOTS to the parent folder containing the historic relative path, e.g. parent of RiseOfTheKillbots or Sky.'},indent=2))
