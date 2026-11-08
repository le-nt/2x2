#!/usr/bin/env python3
"""Stage known missing classic Roblox bundled textures into WSL engine content.

This is NOT a shareddata file repair, and it does not fetch numeric assets.
Copies verified same-named texture files from archived Novetus client content.
Never overwrites existing files. Preview by default.
"""
import argparse, hashlib, shutil
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--project',type=Path,default=Path('/mnt/d/RBXBanland'))
p.add_argument('--engine',type=Path,default=Path.home()/'2x2-build/engine')
p.add_argument('--apply',action='store_true')
a=p.parse_args()
target=a.engine/'.assets/content/textures'
if not (a.engine/'CMakeLists.txt').is_file() or not target.is_dir():
    p.error('--engine must be an existing 2x2 source tree with .assets/content/textures')
if not (a.project/'clients').is_dir():p.error('--project must contain clients/')
names=['SpawnLocation.png','RocketBoots.png']
candidates=[a.project/'clients'/version/'content/textures'
            for version in ('2009E','2008M','2009L','2007M','2007E')]
for name in names:
    out=target/name
    if out.exists():
        print('EXISTS:',out)
        continue
    source=next((root/name for root in candidates if (root/name).is_file()),None)
    if not source:
        print('MISSING SOURCE:',name)
        continue
    print('STAGE:',source,'=>',out,'sha256',hashlib.sha256(source.read_bytes()).hexdigest())
    if a.apply:
        out.parent.mkdir(parents=True,exist_ok=True)
        # Exclusive create: never replace existing content.
        with source.open('rb') as src, out.open('xb') as dst:
            shutil.copyfileobj(src,dst)
print('No files changed.' if not a.apply else 'Staging finished. Rebuild UniversalClient to update .data.')
