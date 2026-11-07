#!/usr/bin/env python3
"""2x2 bulk Novetus asset recovery and BakonBot-inspired XML compatibility build.

Only --activate edits the native place registry. The original maps and browser
launcher are never rewritten. No downloaded code is executed by this program.
"""
import argparse
import concurrent.futures as futures
import hashlib
import importlib.util
import json
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.parse
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ID = re.compile(r'[1-9][0-9]{0,15}\Z')
PLACE = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,150}\Z')
MAX_FILE = 64 * 1024 * 1024
MAX_XML = 200 * 1024 * 1024
EXTS = ('.rbxm','.rbxmx','.mesh','.png','.jpg','.jpeg','.dds','.wav','.mp3','.ogg')
ITEM_RE = re.compile(rb'<(/?)Item(?=[\s>])[^>]*>')
BAD_REF_RE = re.compile(rb'&#(x[0-9a-fA-F]+|[0-9]+);')
SCRIPT_APIS = (b'task.wait',b'task.spawn',b'workspace:Raycast',b'game:GetService("TweenService")',b'continue\n',b':: ',b'`')


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def atomic_json(path, obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile('w',encoding='utf-8',dir=path.parent,delete=False,suffix='.tmp') as f:
        json.dump(obj,f,indent=2,ensure_ascii=False);f.write('\n');tmp=Path(f.name)
    os.replace(tmp,path)


def sha(data):return hashlib.sha256(data).hexdigest()


def import_dependency():
    p=HERE/'import-novetus-assets.py'
    spec=importlib.util.spec_from_file_location('novetus_2x2_assets',p)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def detect(payload,path,old):
    kind=old.classify(payload,path)
    if kind:return kind
    head=payload[:256].lstrip(b'\xef\xbb\xbf\x20\t\r\n')
    if head.startswith(b'<roblox') or head.startswith(b'<?xml') and b'<roblox' in payload[:4096]:return '.rbxmx'
    if path.startswith('scripts/') and path.lower().endswith('.lua'):
        try:payload.decode('utf-8')
        except UnicodeDecodeError:return None
        if b'\x00' not in payload and not head.lstrip().startswith(b'<html'):return '.lua'
    return None


def safe_file(root,path):
    if path.is_symlink() or not path.is_file():return False
    try:return path.resolve().is_relative_to(root.resolve())
    except (ValueError,OSError):return False


def download_one(root,row,index,old,force=False):
    aid=row['id']; recovery=root/'server/native/asset-recovery'
    cache=root/'server/native/asset-library'; stage=recovery/'novetus-staging'
    scriptdir=recovery/'scripts'; quarantine=recovery/'unrecognized'
    for d in (cache,stage,scriptdir,quarantine):d.mkdir(parents=True,exist_ok=True)
    # No overwrites, including any manually restored content.
    if not force and any((cache/(aid+ext)).exists() for ext in EXTS):
        return {'id':aid,'status':'already_cached','placesNeeding':row['placesNeeding']}
    if not force and any((stage/(aid+ext)).exists() for ext in EXTS):
        return {'id':aid,'status':'already_staged','placesNeeding':row['placesNeeding']}
    failures=[]; result={'id':aid,'status':'unavailable','placesNeeding':row['placesNeeding'],'files':[]}
    for source in index[aid]:
        path=source['path']
        if not old.safe_source_path(path,aid):continue
        url=old.RAW_BASE+urllib.parse.quote(path,safe='/')
        data=None
        for attempt in range(3):
            try:
                data=old.read_url(url,MAX_FILE)
                if len(data)!=source['bytes'] or old.github_blob_sha(data)!=source['sha']:
                    raise ValueError('Git blob hash/length mismatch')
                if data.startswith(b'version https://git-lfs.github.com/spec/v1'):
                    raise ValueError('Git LFS pointer, not asset bytes')
                break
            except (OSError, ValueError, urllib.error.URLError) as e:
                failures.append({'path':path,'error':str(e)[:160]});data=None
                if attempt<2:time.sleep(0.5*(attempt+1))
        if data is None:continue
        ext=detect(data,path,old)
        if ext=='.lua':
            dest=scriptdir/(aid+'.lua')
            status='script_saved_separately'
        elif ext in EXTS:
            dest=stage/(aid+ext)
            status='staged'
        else:
            # Keep unknown assets as quarantined binaries so they can be converted later.
            dest=quarantine/(aid+'-'+source['sha'][:12]+'.bin')
            status='unknown_quarantined'
        if not dest.exists():
            try:
                with dest.open('xb') as f:f.write(data)
            except FileExistsError:pass
        result['files'].append({'source':path,'destination':str(dest.relative_to(root)).replace('\\','/'),
                                'type':ext or 'unclassified','bytes':len(data),'sha256':sha(data)})
        if status=='staged':
            result['status']=status
            # Continue checking other candidates: an ID can have both a mesh
            # and a linked Lua file in Novetus's archive.
            continue
        if result['status']=='unavailable':result['status']=status
    if failures:result['errors']=failures[:8]
    return result


def recover(root,workers,limit=None,refresh=False):
    old=import_dependency()
    missing=old.load_missing(root)
    index,index_path=old.load_tree(root,refresh)
    matches=[{'id':aid,'placesNeeding':uses} for aid,uses in missing if aid in index]
    if limit is not None:matches=matches[:limit]
    recovery=root/'server/native/asset-recovery'
    reportpath=recovery/'bulk-download-report.json'
    previous={}
    if reportpath.exists():
        try:previous={r['id']:r for r in load(reportpath).get('results',[])}
        except (ValueError,KeyError):pass
    counter=Counter();combined=dict(previous)
    print(f'[assets] {len(matches)} matched IDs selected; {len(missing)} missing in total',flush=True)
    with futures.ThreadPoolExecutor(max_workers=workers) as pool:
        submitted={pool.submit(download_one,root,row,index,old):row for row in matches}
        for count,task in enumerate(futures.as_completed(submitted),1):
            row=submitted[task]
            try:result=task.result()
            except Exception as e:result={'id':row['id'],'status':'error','error':str(e)[:250]}
            combined[row['id']]=result;counter[result['status']]+=1
            if count%25==0 or count==len(submitted):
                atomic_json(reportpath,{'schemaVersion':2,'matchedIds':len(matches),
                    'completedThisRun':count,'counts':dict(counter),'results':list(combined.values())})
                print(f'[assets] {count}/{len(matches)} {dict(counter)}',flush=True)
    return combined


def import_staged(root):
    stage=root/'server/native/asset-recovery/novetus-staging'
    cache=root/'server/native/asset-library';cache.mkdir(parents=True,exist_ok=True)
    stats=Counter()
    if not stage.exists():return stats
    for file in sorted(stage.iterdir()):
        if not safe_file(stage,file) or not ID.fullmatch(file.stem) or file.suffix.lower() not in EXTS:
            stats['skipped']+=1;continue
        if not 0<file.stat().st_size<=MAX_FILE:stats['skipped']+=1;continue
        dest=cache/(file.stem+file.suffix.lower())
        if dest.exists():stats['alreadyPresent']+=1;continue
        try:
            with file.open('rb') as src,dest.open('xb') as target:
                shutil.copyfileobj(src,target,1024*1024)
            stats['imported']+=1
        except FileExistsError:stats['alreadyPresent']+=1
        except Exception:
            dest.unlink(missing_ok=True)
            raise
    return stats


def xml_safe_ref(match):
    token=match.group(1)
    try: val=int(token[1:],16) if token.startswith(b'x') else int(token)
    except ValueError:return b'&#xFFFD;'
    if val not in (9,10,13) and (val<32 or 0xD800<=val<=0xDFFF or val>0x10FFFF or 0xFFFE<=val<=0xFFFF):
        return b'&#xFFFD;'
    return match.group(0)


def remove_terrain(data):
    """Balanced Item removal (regex-only closing-tag removal corrupts nested Terrain)."""
    actions=[]; stack=[]
    for m in ITEM_RE.finditer(data):
        if not m.group(1):
            terrain=bool(re.search(rb'\bclass\s*=\s*[\'\"]Terrain[\'\"]',m.group()))
            stack.append((m.start(),terrain))
        elif stack:
            start,terrain=stack.pop()
            if terrain:actions.append((start,m.end()))
    for start,end in reversed(actions):data=data[:start]+data[end:]
    return data,len(actions)


COLOR_MAP={ # BakonBot palette mappings, only exact matches are rewritten
    4294112243:1,4294901760:1004,4288986439:119,4294298928:24,
    4292511041:106,4291045404:21,4285215356:104,4279069100:23,
    4278226844:107,4283144011:37,4294506744:1001,4293256415:208,
    4291677645:1002,4288914085:194,4284702562:199,4279970357:26,
    4279308561:1003,4286549604:1022,4293040960:105,4293572754:125,
    4287986039:153,4287388575:1023,4285826717:135,4285438410:102,
    4286091394:151,4292330906:5,4294830733:226,4294946560:1017,
    4292511354:101,4293442248:9,4286626779:11,4279430868:1018,
    4288791692:29,4294954137:1030,4294967244:1029,4294953417:1025,
    4294928076:1016,4289832959:1026,4289715711:1024,4288672745:1027,
    4291624908:1028,4290887234:1008,4294967040:1009,4294901951:1032,
    4278190335:1010,4278255615:1019,4278255360:1020,4286340166:217,
    4291595881:18,4288700213:38,4284622289:1031,4290019583:1006,
    4278497260:1013,4290040548:45,4282023189:1021,4285087784:192,
    4289352960:1014,4288891723:1007,4289331370:1015,4280374457:1012,
    4278198368:1011,4280844103:28,4280763949:141,
}
SIZES=(8,9,10,11,12,14,18,24,36,48)


def convert_xml(data, asset_template=''):
    if b'<roblox' not in data[:4096]:raise ValueError('Not Roblox XML')
    stats=Counter()
    data,n=remove_terrain(data);stats['terrainRemoved']=n
    data,n=re.subn(rb'<Item\s+class="Folder"',b'<Item class="Model"',data)
    stats['foldersConverted']=n
    def brick(m):
        value=COLOR_MAP.get(int(m.group(1)))
        if value is None:return m.group(0)
        stats['colorsConverted']+=1
        return b'<int name="BrickColor">'+str(value).encode()+b'</int>'
    data=re.sub(rb'<Color3uint8\s+name="Color3uint8">(\d+)</Color3uint8>',brick,data)
    def font(m):
        size=int(m.group(1)); index=min(range(len(SIZES)),key=lambda i:abs(SIZES[i]-size))
        stats['fontsConverted']+=1
        return b'<token name="FontSize">'+str(index).encode()+b'</token>'
    data=re.sub(rb'<float\s+name="TextSize">(\d+(?:\.\d+)?)</float>',
                lambda m:font(re.match(rb'(\d+)',m.group(1))) if re.fullmatch(rb'\d+',m.group(1)) else m.group(0),data)
    # Only property content, never arbitrary Lua Source text.
    if asset_template:
        if '{id}' not in asset_template:raise ValueError('--asset-template needs {id}')
        def repl(m):
            ref=m.group(2).decode('ascii');stats['urlReferencesRewritten']+=1
            return m.group(1)+asset_template.replace('{id}',ref).encode()+m.group(3)
        data=re.sub(rb'(<url>\s*)rbxassetid://([1-9][0-9]{0,15})(\s*</url>)',repl,data)
    data,n=BAD_REF_RE.subn(xml_safe_ref,data)
    stats['characterReferencesExamined']=n
    stats['modernApiHints']=sum(data.count(x) for x in SCRIPT_APIS)
    return data,dict(stats)


def build_places(root,activate=False,asset_template='',include_crossroads=False):
    native=root/'server/native'
    registry_path=native/'places.json'
    registry=load(registry_path)
    if 'places' not in registry:raise ValueError('Invalid native registry')
    originals=native/'maps';converted=originals/'2x2-compat'
    converted.mkdir(parents=True,exist_ok=True)
    results=[];updated=json.loads(json.dumps(registry))
    for num,(pid,row) in enumerate(sorted(registry['places'].items()),1):
        if not PLACE.fullmatch(pid):continue
        if 'crossroads' in pid.lower() and not include_crossroads:
            results.append({'id':pid,'status':'protected_crossroads'});continue
        orig_name=row.get('file','')
        if not isinstance(orig_name,str) or '/' in orig_name or '\\' in orig_name:continue
        file=originals/orig_name
        if not safe_file(originals,file):
            results.append({'id':pid,'status':'file_missing'});continue
        if file.stat().st_size>MAX_XML:
            results.append({'id':pid,'status':'file_too_large'});continue
        data=file.read_bytes()
        if b'<roblox' not in data[:4096]:
            results.append({'id':pid,'status':'binary_ignored'});continue
        original_sha=sha(data)
        compat_name='2x2-compat/'+pid+'.rbxl'
        dest=originals/compat_name
        try:
            data,stats=convert_xml(data,asset_template)
            if not data.startswith(b'<?xml') and not data.lstrip().startswith(b'<roblox'):
                raise ValueError('Bad converted XML header')
            digest=sha(data)
            if not dest.is_file() or sha(dest.read_bytes())!=digest:
                with tempfile.NamedTemporaryFile('wb',dir=converted,delete=False,suffix='.tmp') as f:
                    f.write(data);temp=Path(f.name)
                os.replace(temp,dest)
            results.append({'id':pid,'status':'converted_copy','sourceSha256':original_sha,
                            'convertedSha256':digest,'path':compat_name,'changes':stats})
            if activate:
                updated['places'][pid]['file']=compat_name
                updated['places'][pid]['sha256']=digest
        except (OSError,ValueError,UnicodeError) as e:
            results.append({'id':pid,'status':'conversion_failed','error':str(e)[:200]})
        if num%25==0:print('[places]',num,'/',len(registry['places']),flush=True)
    report=native/'asset-recovery/bulk-places-report.json'
    atomic_json(report,{'schemaVersion':1,'activationRequested':activate,'counts':dict(Counter(x['status'] for x in results)),'results':results})
    backup=None
    if activate and updated!=registry:
        # Immutable, timestamped rollback of exact registry bytes.
        backups=native/'asset-recovery/registry-backups';backups.mkdir(parents=True,exist_ok=True)
        backup=backups/('places-'+time.strftime('%Y%m%d-%H%M%S')+'.json')
        with backup.open('xb') as out:out.write(registry_path.read_bytes())
        atomic_json(registry_path,updated)
    return dict(Counter(x['status'] for x in results)),backup


def rollback(root, backup=None):
    registry=root/'server/native/places.json'
    folder=root/'server/native/asset-recovery/registry-backups'
    if backup is None:
        options=sorted(folder.glob('places-*.json')) if folder.exists() else []
        if not options:raise ValueError('No registry backups found')
        backup=options[-1]
    else:
        backup=Path(backup).resolve(strict=True)
        if not backup.is_relative_to(folder.resolve()):raise ValueError('Backup must be inside registry-backups')
    old=load(backup)
    if not isinstance(old.get('places'),dict):raise ValueError('Invalid registry backup')
    snapshot=folder/('pre-rollback-'+time.strftime('%Y%m%d-%H%M%S')+'.json')
    if registry.exists():
        with snapshot.open('xb') as f:f.write(registry.read_bytes())
    with tempfile.NamedTemporaryFile('wb',dir=registry.parent,delete=False,suffix='.tmp') as f:
        f.write(backup.read_bytes());tmp=Path(f.name)
    os.replace(tmp,registry)
    return {'restored':str(backup),'savedPreviousRegistry':str(snapshot)}


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=HERE.parent)
    p.add_argument('--all',action='store_true',help='Run complete bulk recovery and XML conversion')
    p.add_argument('--assets-only',action='store_true')
    p.add_argument('--places-only',action='store_true')
    p.add_argument('--activate',action='store_true',help='Switch native registry to generated copies; original preserved and backup created')
    p.add_argument('--include-crossroads',action='store_true',help='Also convert manually repaired Crossroads (not recommended)')
    p.add_argument('--asset-template',default='',help='Optional local asset URL template containing {id}')
    p.add_argument('--workers',type=int,default=4)
    p.add_argument('--limit',type=int,default=None,help='Optional asset ID limit; omit for all')
    p.add_argument('--refresh-index',action='store_true')
    p.add_argument('--rollback',action='store_true',help='Restore the newest saved registry without deleting any maps')
    p.add_argument('--backup',help='Specific registry backup path with --rollback')
    args=p.parse_args(argv)
    if not 1<=args.workers<=8:p.error('--workers must be 1..8')
    if args.limit is not None and args.limit<1:p.error('--limit must be positive')
    if args.assets_only and args.places_only:p.error('Choose only one subtask')
    root=args.root.resolve(strict=True)
    if args.rollback:
        print(json.dumps(rollback(root,args.backup),indent=2));return 0
    summary={'schemaVersion':1,'root':str(root),'launcherModified':False,'originalMapsModified':False}
    if not args.places_only:
        downloaded=recover(root,args.workers,args.limit,args.refresh_index)
        summary['assets']=dict(Counter(x['status'] for x in downloaded.values()))
        summary['assetImport']=dict(import_staged(root))
    if not args.assets_only:
        counts,backup=build_places(root,args.activate,args.asset_template,args.include_crossroads)
        summary['places']=counts
        summary['registryBackup']=str(backup) if backup else None
    atomic_json(root/'server/native/asset-recovery/bulk-compat-summary.json',summary)
    print(json.dumps(summary,indent=2))
    return 0


if __name__=='__main__':
    try:raise SystemExit(main())
    except (OSError,ValueError,KeyError,urllib.error.URLError,json.JSONDecodeError) as e:
        print('ERROR:',e,file=sys.stderr);raise SystemExit(1)
