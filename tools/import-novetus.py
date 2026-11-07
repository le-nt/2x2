#!/usr/bin/env python3
"""Import every current and legacy Novetus map, preserving website/native IDs."""
import argparse,bz2,datetime,hashlib,json,os,re,shutil,tempfile,urllib.request,zipfile
from pathlib import Path,PurePosixPath
REPOSITORY='Novetus/Novetus-Map-Pack'
COMMIT='6d7c962e3afe81d61a868b301771767d06471426'
MAX_MAP=128*1024*1024

def slug(value):
 value=re.sub(r'[^a-z0-9]+','-',value.lower()).strip('-') or 'map'
 return value if len(value)<=130 else value[:117].rstrip('-')+'-'+hashlib.sha256(value.encode()).hexdigest()[:12]

def decode_description(data):
 return data.decode('utf-16' if data.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig',errors='replace').strip()

def decompress(data,packed):
 if not packed:
  if len(data)>MAX_MAP:raise ValueError('Map exceeds size limit')
  return data
 decoder=bz2.BZ2Decompressor();raw=decoder.decompress(data,max_length=MAX_MAP+1)
 if len(raw)>MAX_MAP or not decoder.eof or decoder.unused_data:raise ValueError('Oversized, truncated or concatenated bzip2 map')
 return raw

def map_format(data):
 if data.startswith(b'<roblox!\x89\xff\r\n\x1a\n'):return 'binary'
 if re.match(br'\s*(?:<\?xml[^>]*>\s*)?<roblox(?:\s|>)',data.removeprefix(b'\xef\xbb\xbf')[:1024]):return 'xml'
 raise ValueError('Unrecognized Roblox place header')

def atomic_json(file,value):
 file.parent.mkdir(parents=True,exist_ok=True)
 temp=file.with_name(file.name+'.tmp');temp.write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8');os.replace(temp,file)

class Pack:
 def __init__(self,file):
  self.file=file;self.zip=None
  if file.is_dir():
   self.files={p.relative_to(file).as_posix():p for p in file.rglob('*') if p.is_file() and not p.is_symlink()}
   if 'maps' not in {p.split('/')[0]for p in self.files}:
    roots={p.split('/')[0]for p in self.files}
    if len(roots)==1 and next(iter(roots)) not in ('maps','legacy'):
     prefix=next(iter(roots))+'/';self.files={k[len(prefix):]:v for k,v in self.files.items()}
  else:
   self.zip=zipfile.ZipFile(file);names=[i for i in self.zip.infolist() if not i.is_dir()];self.files={}
   for info in names:
    if info.filename.startswith('/') or '..' in PurePosixPath(info.filename).parts or '\\' in info.filename or ':' in info.filename:raise ValueError('Unsafe archive member')
   prefix=''
   if names:
    roots={i.filename.split('/')[0]for i in names}
    if len(roots)==1 and next(iter(roots)) not in ('maps','legacy'):
     prefix=next(iter(roots))+'/'
   for info in names:
    rel=info.filename.removeprefix(prefix);parts=PurePosixPath(rel).parts
    if rel.startswith('/') or '..' in parts or '\\' in rel or ':' in rel:raise ValueError('Unsafe archive member')
    if rel in self.files:raise ValueError('Duplicate archive member: '+rel)
    self.files[rel]=info
 def read(self,rel):
  item=self.files.get(rel)
  if item is None:return None
  if self.zip:
   if item.file_size>MAX_MAP:raise ValueError('Oversized pack entry')
   return self.zip.read(item)
  return item.read_bytes()
 def close(self):
  if self.zip:self.zip.close()

def import_pack(root,pack_path,index_path=None):
 root=root.resolve();catalog_file=root/'site/data/maps.json';registry_file=root/'server/native/places.json';storage=root/'server/native/maps';storage.mkdir(parents=True,exist_ok=True)
 catalog=json.loads(catalog_file.read_text(encoding='utf-8'));rows=catalog['maps'];by_id={row['id']:row for row in rows}
 by_source={row.get('source',{}).get('path'):row for row in rows if row.get('source',{}).get('repository')==REPOSITORY}
 registry=json.loads(registry_file.read_text()) if registry_file.exists() else {'format':1,'places':{}};places=registry['places'];next_id=max([int(v['id']) for v in places.values()]+[0])+1
 if len({v['id']for v in places.values()})!=len(places):raise ValueError('Native place registry contains duplicate numeric IDs')
 index=json.loads(index_path.read_text()) if index_path and index_path.is_file() else None
 expected={r['path']:r for r in index.get('files',[])} if index else {}
 pack=Pack(pack_path);report=[];formats={};compressed_total=raw_total=0
 try:
  paths=sorted(rel for rel in pack.files if rel.startswith(('maps/','legacy/')) and re.search(r'\.rbxl(?:\.bz2)?$',rel,re.I))
  if not paths:raise ValueError('No maps found in maps/ or legacy/')
  if index:
   expected_maps={rel for rel in expected if re.search(r'\.rbxl(?:\.bz2)?$',rel,re.I)}
   if set(paths)!=expected_maps:raise ValueError('Map list differs from pinned source index; use the bundled pack/index together')
  stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f');backup=root/('backup-map-pack-'+stamp)
  backup.mkdir();shutil.copy2(catalog_file,backup/'maps.json')
  if registry_file.exists():shutil.copy2(registry_file,backup/'places.json')
  used=set()
  for rel in paths:
   original=pack.read(rel)
   if index:
    record=expected[rel];git_sha=hashlib.sha1(b'blob '+str(len(original)).encode()+b'\0'+original).hexdigest()
    if record['sha']!=git_sha or record['size']!=len(original):raise ValueError('Source verification failed: '+rel)
   raw=decompress(original,rel.lower().endswith('.bz2'));kind=map_format(raw);formats[kind]=formats.get(kind,0)+1
   raw_hash=hashlib.sha256(raw).hexdigest();compressed_total+=len(original);raw_total+=len(raw)
   stem=PurePosixPath(rel).name.removesuffix('.bz2').removesuffix('.rbxl')
   candidate=('legacy-' if rel.startswith('legacy/') else '')+slug(stem)
   row=by_source.get(rel)
   if row is None:
    occupied=by_id.get(candidate)
    if occupied and occupied.get('source',{}).get('path') not in (None,rel):candidate+='-'+hashlib.sha256(rel.encode()).hexdigest()[:8];occupied=by_id.get(candidate)
    if candidate in used:candidate+='-'+hashlib.sha256(rel.encode()).hexdigest()[:8];occupied=by_id.get(candidate)
    # A previously imported, untagged catalog entry may be claimed once.
    # Never attach a second pack source to the same row.
    if occupied and occupied['id'] in used:
     candidate+='-'+hashlib.sha256((rel+'collision').encode()).hexdigest()[:8]
     occupied=by_id.get(candidate)
    row=occupied
    if row is None:row={'id':candidate,'visits':0,'thumb':False};rows.append(row);by_id[candidate]=row
   mid=row['id'];used.add(mid);previous_year=row.get('year',0)
   era_match=re.match(r'(20\d{2}[EML]?)\s*-',stem,re.I)
   year_match=re.search(r'(?<!\d)(20\d{2})(?!\d)',rel)
   year=int(year_match.group(1)) if year_match else previous_year
   era=era_match.group(1).upper() if era_match else ('Universal' if '/Universal/' in rel else 'Dev' if stem.startswith('Dev -') else 'Novetus Exclusive')
   if rel.startswith('legacy/'):era='Legacy '+(str(year) if year else era)
   title=re.sub(r'^(?:20\d{2}[EML]?|Universal|Dev)\s*-\s*','',stem,flags=re.I)
   desc_rel=rel.removesuffix('.bz2').removesuffix('.rbxl')+'_desc.txt';description=pack.read(desc_rel)
   source={'repository':REPOSITORY,'commit':index.get('commit') if index else None,'path':rel,'sha256':raw_hash,'compressedSha256':hashlib.sha256(original).hexdigest(),'format':kind}
   row.update({'name':row.get('name')or title,'description':decode_description(description) if description else row.get('description',''),'era':era,'year':year,'sizeKB':(len(raw)+1023)//1024,'zipKB':(len(original)+1023)//1024,'hue':row.get('hue',int(raw_hash[:8],16)%360),'client':row.get('client','Native'),'source':source})
   filename=raw_hash+'.rbxl';destination=storage/filename
   if not destination.exists() or hashlib.sha256(destination.read_bytes()).hexdigest()!=raw_hash:
    temp=destination.with_suffix('.tmp');temp.write_bytes(raw);os.replace(temp,destination)
   if mid not in places:places[mid]={'id':next_id};next_id+=1
   places[mid].update({'file':filename,'name':row['name'],'sha256':raw_hash,'source':source})
   if (len(report)+1)%25==0:print('Imported',len(report)+1,'of',len(paths),'maps...',flush=True)
   report.append({'id':mid,'nativeId':places[mid]['id'],'path':rel,'sha256':raw_hash,'format':kind,'bytes':len(raw)})
  missing=[]
  for existing_row in rows:
   identifier=existing_row['id']
   item=places.get(identifier)
   filename=item.get('file','') if isinstance(item,dict) else ''
   if not isinstance(filename,str) or not re.fullmatch(r'[a-f0-9]{64}\.rbxl|[a-z0-9-]+\.rbxl',filename) or not (storage/filename).is_file():
    missing.append(identifier)
  summary={'repository':REPOSITORY,'commit':index.get('commit')if index else None,'entries':len(report),'uniqueContents':len({r['sha256']for r in report}),'catalogEntries':len(rows),'formats':formats,'compressedBytes':compressed_total,'rawBytesIncludingVariants':raw_total,'unavailableCatalogIds':missing,'maps':report}
  # Existing catalog records/counters and native numeric IDs remain authoritative.
  atomic_json(catalog_file,catalog);atomic_json(registry_file,registry);atomic_json(root/'server/native/missing-maps.json',missing);atomic_json(root/'server/native/novetus-import-report.json',summary)
  return summary
 finally:pack.close()

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--pack',type=Path);p.add_argument('--index',type=Path);p.add_argument('--download',action='store_true');a=p.parse_args();root=a.root.resolve();archive=a.pack or root/'map-pack/Novetus-Map-Pack.zip';index=a.index or root/'map-pack/source-index.json'
 if a.download:
  archive.parent.mkdir(parents=True,exist_ok=True)
  with urllib.request.urlopen(f'https://codeload.github.com/{REPOSITORY}/zip/{COMMIT}',timeout=120) as response:
   with archive.with_suffix('.download').open('wb')as output:shutil.copyfileobj(response,output)
  os.replace(archive.with_suffix('.download'),archive)
 result=import_pack(root,archive,index)
 print('Imported all',result['entries'],'current and legacy pack entries; unique map contents:',result['uniqueContents'])
 print('Website catalog:',result['catalogEntries'],'Native registered places:',len(json.loads((root/'server/native/places.json').read_text())['places']))
 print('Still missing from existing catalog:',len(result['unavailableCatalogIds']))
 print('Restart your Node server before opening Games. Source provenance is in server/native/novetus-import-report.json.')
if __name__=='__main__':main()
