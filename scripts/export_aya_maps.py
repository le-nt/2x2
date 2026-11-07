#!/usr/bin/env python3
"""Extract original .rbxl from BoxedWine map overlays to static Aya import files.
No third-party engine code or assets beyond the user's existing places are downloaded.
"""
from pathlib import Path
import argparse, json, re, zipfile, os

MAX_MAP_BYTES=128*1024*1024

def run(root):
    data=root/'site'/'data'; catalog=data/'maps.json'
    if not catalog.exists():raise SystemExit('Missing '+str(catalog))
    maps=json.loads(catalog.read_text(encoding='utf-8')).get('maps',[])
    dest=data/'aya-maps';dest.mkdir(exist_ok=True)
    success=0;missing=[];failed=[]
    for m in maps:
        mid=m.get('id','')
        if not re.fullmatch(r'[A-Za-z0-9_-]+',mid): failed.append(mid);continue
        overlay=data/('map-'+mid+'.zip')
        if not overlay.exists():missing.append(mid);continue
        try:
            with zipfile.ZipFile(overlay) as z:
                candidates=[x for x in z.infolist() if x.filename.replace('\\','/').endswith('/maps/map.rbxl') and not x.is_dir()]
                if len(candidates)!=1:raise ValueError('Expected one original maps/map.rbxl')
                info=candidates[0]
                if info.file_size>MAX_MAP_BYTES:raise ValueError('Map too large')
                output=dest/(mid+'.rbxl')
                tmp=output.with_suffix('.rbxl.tmp')
                try:
                    with z.open(info) as src, open(tmp,'wb') as target:
                        import shutil
                        shutil.copyfileobj(src,target,1024*1024)
                    os.replace(tmp,output)
                finally:
                    if tmp.exists():tmp.unlink()
                success+=1
        except Exception as e:failed.append(mid+': '+str(e))
    print(f'Exported {success} maps -> {dest}')
    if missing:print(f'{len(missing)} overlays missing; first examples: {missing[:5]}')
    if failed:print(f'{len(failed)} errors; first examples: {failed[:5]}')
    print('Deploy site/data/aya-maps/*.rbxl alongside site/aya.html and site/game.html.')
    return 1 if failed else 0

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args()
    raise SystemExit(run(a.root.resolve()))
