#!/usr/bin/env python3
"""Import actual classic map bytes and assign stable numeric IDs for native workers."""
import argparse,bz2,hashlib,json,re,zipfile,os,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--maps',type=Path,help='Optional raw maps folder; filenames must be the exact classic ID.rbxl or ID.rbxl.bz2');p.add_argument('--skip-asset-seed',action='store_true',help='Do not run offline asset discovery after importing');p.add_argument('--download-assets',action='store_true',help='Try bounded authorized upstream downloads during asset seeding');a=p.parse_args();root=a.root.resolve()
catalog=json.loads((root/'site/data/maps.json').read_text())['maps'];target=root/'server/native';(target/'maps').mkdir(parents=True,exist_ok=True)
file=target/'places.json';existing=json.loads(file.read_text()) if file.exists() else {'format':1,'places':{}};places=existing['places'];next_id=max([v['id'] for v in places.values()]+[0])+1
missing=[];imported=0
for m in catalog:
 mid=m['id'];data=None
 if not re.fullmatch('[a-z0-9-]+',mid):raise SystemExit('Invalid catalog ID')
 search_maps=a.maps or target/'maps'
 if search_maps:
  raw=search_maps/(mid+'.rbxl');packed=search_maps/(mid+'.rbxl.bz2')
  if raw.is_file():data=raw.read_bytes()
  elif packed.is_file():data=bz2.decompress(packed.read_bytes())
 overlay=root/'site/data'/('map-'+mid+'.zip')
 if data is None and overlay.is_file():
  with zipfile.ZipFile(overlay) as z:
   candidates=[i for i in z.infolist() if i.filename.replace('\\','/').endswith('/maps/map.rbxl') or i.filename=='map.rbxl']
   if len(candidates)!=1:raise SystemExit('Expected one original map.rbxl in '+str(overlay))
   if candidates[0].file_size>128*1024*1024:raise SystemExit('Map exceeds 128 MiB')
   data=z.read(candidates[0])
 if data is None:
  if mid not in places:missing.append(mid)
  continue
 header=data.removeprefix(b'\xef\xbb\xbf').lstrip()
 if not (header.startswith(b'<roblox') or (header.startswith(b'<?xml') and b'<roblox' in header[:1024])):raise SystemExit('Not a Roblox map: '+mid)
 out=target/'maps'/(mid+'.rbxl');out.write_bytes(data)
 if mid not in places:places[mid]={'id':next_id};next_id+=1
 places[mid].update({'file':mid+'.rbxl','name':m['name'],'sha256':hashlib.sha256(data).hexdigest()});imported+=1
file.write_text(json.dumps(existing,indent=2)+'\n');(target/'missing-maps.json').write_text(json.dumps(missing,indent=2)+'\n')
print('Imported:',imported,'Available records:',len(places),'Missing original map files:',len(missing))
print('Missing IDs are recorded in server/native/missing-maps.json. No substitute maps were invented.')

# Existing catalog imports also get asset coverage automatically. No online requests
# unless explicitly enabled or an Open Cloud key is configured on the server.
if imported and not a.skip_asset_seed:
 cmd=['node',str(root/'tools/seed-native-assets.mjs'),'--root',str(root)]
 if a.download_assets or os.environ.get('ROBLOX_OPEN_CLOUD_API_KEY'):
  cmd+=['--download','--max-fetch','100']
 print('Discovering imported game assets (network:', '--download' in cmd, ')',flush=True)
 subprocess.run(cmd,cwd=root,check=True)
