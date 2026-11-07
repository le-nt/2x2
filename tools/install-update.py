#!/usr/bin/env python3
"""Apply the update without fragile text anchors or replacing keys/accounts."""
import argparse,datetime,shutil,subprocess,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=Path);a=p.parse_args();source=Path(__file__).resolve().parents[1];root=a.root.resolve()
if root==source:raise SystemExit('Already inside the installed project. Run import-native.py directly, or extract the update elsewhere before using this installer.')
if not (root/'server/lib/api.mjs').is_file() or not (root/'site/data/maps.json').is_file():raise SystemExit('Target is not an existing 2x2/RBXBanland project root.')
backup=root/('backup-native-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));count=0
protected=['server/config.json','server/data/','services/arbiter/2x2-config.json','server/native/places.json','site/native-client/','site/data/maps.json']
for file in source.rglob('*'):
 if not file.is_file():continue
 rel=file.relative_to(source);name=rel.as_posix()
 if name.startswith('backup-') or any(name==entry or name.startswith(entry) for entry in protected):continue
 destination=root/rel
 if destination.is_file():
  if destination.read_bytes()==file.read_bytes():continue
  saved=backup/rel;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(destination,saved)
 destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,destination);count+=1
if (root/'map-pack/Novetus-Map-Pack.zip').is_file():
 subprocess.run([sys.executable,str(root/'tools/import-novetus.py'),'--root',str(root)],check=True)
else:
 subprocess.run([sys.executable,str(root/'tools/import-native.py'),'--root',str(root)],check=True)
print('Updated',count,'files. Previous changed files, if any, are in:',backup)
print('Existing entrance key/configuration, accounts, and compiled WebClient were preserved.')
print('Restart the server. Configure/build the native worker and install the WebClient before testing Play.')
