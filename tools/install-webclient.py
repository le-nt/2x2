#!/usr/bin/env python3
"""Install compiled Project Pizda WebClient artifacts, not Wine or an EXE."""
import argparse,hashlib,json,os,shutil,tarfile,tempfile
from pathlib import Path,PurePosixPath
p=argparse.ArgumentParser();p.add_argument('bundle',type=Path,help='Built UniversalClient directory or .tar.xz bundle');p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);a=p.parse_args()
root=a.root.resolve();destination=root/'site/native-client';destination.parent.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='2x2-webclient-',dir=destination.parent) as tmp:
 stage=Path(tmp);files={}
 if a.bundle.is_dir():
  candidates=[(f.relative_to(a.bundle).as_posix(),f.read_bytes()) for f in a.bundle.rglob('*') if f.is_file() and not f.is_symlink() and f.suffix.lower() in {'.js','.wasm','.data','.json','.map'}]
 else:
  with tarfile.open(a.bundle,'r:*') as archive:
   candidates=[]
   for member in archive:
    if member.isdir():continue
    name=member.name.removeprefix('./');path=PurePosixPath(name)
    if not member.isfile() or path.is_absolute() or '..' in path.parts or '\\' in name or ':' in name:raise SystemExit('Unsafe archive member: '+name)
    if member.size>1024*1024*1024:raise SystemExit('Client file exceeds 1 GiB limit')
    if path.suffix.lower() in {'.js','.wasm','.data','.json','.map'}:
     stream=archive.extractfile(member)
     if stream:candidates.append((name,stream.read()))
 # Flatten a common bundle wrapper directory while preserving worker subdirectories.
 entries=[name for name,_ in candidates if PurePosixPath(name).name=='UniversalClient.js']
 if len(entries)!=1:raise SystemExit('Expected exactly one built UniversalClient.js')
 prefix=PurePosixPath(entries[0]).parent
 for name,data in candidates:
  try:relative=PurePosixPath(name).relative_to(prefix)
  except ValueError:continue
  rel=relative.as_posix()
  if rel in files:raise SystemExit('Duplicate artifact: '+rel)
  target=stage/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
  files[rel]={'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 for name in ['UniversalClient.js','UniversalClient.wasm','UniversalClient.data']:
  if name not in files:raise SystemExit('Missing compiled client artifact: '+name)
 if (stage/'UniversalClient.wasm').read_bytes()[:8]!=b'\x00asm\x01\x00\x00\x00':raise SystemExit('UniversalClient.wasm is not a WebAssembly v1 binary')
 (stage/'manifest.json').write_text(json.dumps({'format':1,'entry':'UniversalClient.js','files':files},indent=2)+'\n')
 backup=destination.with_name('native-client.previous')
 if destination.exists():
  if backup.exists():raise SystemExit('Move site/native-client.previous before installing another version; it is kept as a backup.')
  destination.rename(backup)
 shutil.copytree(stage,destination)
print('Installed native client:',destination)
