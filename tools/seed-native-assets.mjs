#!/usr/bin/env node
/**
 * 2x2 incremental asset seeder.
 *
 * Default: offline discovery, archive copies of available local assets,
 * recurse into available model dependencies, and generate per-place reports.
 * --download: allow bounded upstream requests through 2x2's existing resolver.
 * Does not modify source maps, database, compiled game clients, or imported
 * asset library. Intended to run again after new archives are mounted.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createAssetResolver} from '../server/lib/asset-resolver.mjs';
import {scanAssetReferences,looksLikeRobloxModel,validAssetId} from '../server/lib/asset-discovery.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function flags(argv) {
  const options={download:false,maxFetch:250,maxAssets:10000,maxDepth:4,place:null};
  for (let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if (arg==='--download') options.download=true;
    else if (arg==='--place') options.place=argv[++i];
    else if (['--max-fetch','--max-assets','--max-depth'].includes(arg)) {
      const n=Number(argv[++i]);
      if (!Number.isSafeInteger(n)||n<0) throw Error('Invalid value for '+arg);
      options[arg==='--max-fetch'?'maxFetch':arg==='--max-assets'?'maxAssets':'maxDepth']=n;
    } else throw Error('Unknown option: '+arg);
  }
  if (options.maxAssets>100000 || options.maxFetch>10000 || options.maxDepth>12)
    throw Error('Safety limit exceeded');
  return options;
}
const opts=flags(process.argv.slice(2));
const python=process.env.RBX_PYTHON||(process.platform==='win32'?'py':'python3');
const serverDir=path.join(root,'server');
const nativeDir=path.join(serverDir,'native');
const mapDir=path.join(nativeDir,'maps');
const seedDir=path.join(nativeDir,'asset-seed');
const reportsDir=path.join(nativeDir,'asset-reports');
const indexPath=path.join(nativeDir,'asset-index.json');
const resolver=createAssetResolver({serverDir,siteDir:path.join(root,'site')});
const places=JSON.parse(fs.readFileSync(path.join(nativeDir,'places.json'),'utf8')).places;
if (opts.place && !Object.hasOwn(places,opts.place)) throw Error('Unknown place ID: '+opts.place);

const ids=new Map();
const perPlace=new Map();
const diagnostics=[];
const stats={scannedPlaces:0,unscannedPlaces:0,assetReferences:0,local:0,downloaded:0,missing:0,skipped:0,modelDependencies:0,upstreamAttempts:0};
const queue=[];
const visited=new Set();
let totalUnique=0;

function remember(id,placeId,depth,parent) {
  if (!validAssetId(id)) return;
  if (!perPlace.has(placeId)) perPlace.set(placeId,new Set());
  perPlace.get(placeId).add(id);
  if (!ids.has(id)) {
    if (totalUnique>=opts.maxAssets) {stats.skipped++;return;}
    ids.set(id,{id,places:new Set(),parents:new Set(),status:'pending',depth,sha256:null,size:null,extension:null});
    totalUnique++;
  }
  const record=ids.get(id);
  if (!record) return;
  record.places.add(placeId);
  if(parent)record.parents.add(parent);
  if(depth>opts.maxDepth)return;
  const key=placeId+':'+id;
  if (visited.has(key))return;
  visited.add(key);
  queue.push({id,placeId,depth});
}
function safeMap(file) {
  if (typeof file!=='string' || path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) return null;
  try {
    const base=fs.realpathSync(mapDir);
    const real=fs.realpathSync(path.join(mapDir,file));
    if (!real.startsWith(base+path.sep)) return null;
    const stat=fs.statSync(real);
    return stat.isFile()&&stat.size<=128*1024*1024?real:null;
  } catch {return null;}
}
function classify(buf,fileName='') {
  if(looksLikeRobloxModel(buf)) return 'model';
  const head=buf.subarray(0,12);
  if(head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image';
  if(head.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff])))return 'image';
  if(head.subarray(0,4).toString('ascii')==='OggS')return 'audio';
  if(head.subarray(0,4).toString('ascii')==='RIFF')return 'audio';
  if(head.subarray(0,3).toString('ascii')==='ID3')return 'audio';
  if(head.subarray(0,4).toString('ascii')==='DDS ')return 'image';
  return fileName.endsWith('.lua')||fileName.endsWith('.txt')?'text':'unknown';
}
function atomicJson(file,data) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=file+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';
  try { fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n');fs.renameSync(temp,file); }
  finally {try{fs.unlinkSync(temp);}catch{}}
}
function inspectReferences(file,bytes) {
  const first=scanAssetReferences(bytes);
  if(first.coverage!=='binary_strings_partial')return first;
  const binaryScanner=path.join(root,'tools','scan-binary-asset-ids.py');
  const args=process.platform==='win32'&&python==='py'?['-3',binaryScanner,file]:[binaryScanner,file];
  const run=spawnSync(python,args,{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024,windowsHide:true});
  if(run.status!==0) return {...first,coverage:'binary_partial_decoder_unavailable',error:(run.stderr||run.error?.code||'decoder_unavailable').slice(0,180)};
  try {
    const decoded=JSON.parse(run.stdout);
    return {...first,ids:[...new Set([...first.ids,...decoded.ids.filter(validAssetId)])].sort((a,b)=>Number(a)-Number(b)),
      coverage:decoded.unsupportedProperties.length?'binary_decoded_partial':'binary_decoded',
      unsupportedProperties:decoded.unsupportedProperties};
  } catch(error){return {...first,coverage:'binary_partial_decoder_invalid_response'};}
}
function archiveAsset(record,found) {
  const content=fs.readFileSync(found.file);
  if (!content.length || content.length>64*1024*1024) throw Error('Invalid archive size');
  const hash=crypto.createHash('sha256').update(content).digest('hex');
  const ext=found.ext && /^\.[a-z0-9]{2,5}$/i.test(found.ext)?found.ext.toLowerCase():'';
  // One asset ID maps to one complete, immutable archive object.
  const destination=path.join(seedDir,record.id+ext);
  fs.mkdirSync(seedDir,{recursive:true});
  if (!fs.existsSync(destination)) {
    const temp=destination+'.'+crypto.randomUUID()+'.tmp';
    try {
      fs.writeFileSync(temp,content,{flag:'wx'});
      fs.renameSync(temp,destination);
    } finally {try{fs.unlinkSync(temp);}catch{}}
  } else if (crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex')!==hash) {
    throw Error('Archive content conflict for '+record.id+'; refusing to overwrite existing seed');
  }
  record.sha256=hash;
  record.size=content.length;
  record.extension=ext;
  record.kind=classify(content,found.file);
  record.file=path.relative(nativeDir,destination).replaceAll(path.sep,'/');
  return content;
}

for(const [placeId,entry] of Object.entries(places)) {
  if(opts.place && opts.place!==placeId)continue;
  perPlace.set(placeId,new Set());
  const file=safeMap(entry.file);
  if (!file) {diagnostics.push({place:placeId,reason:'map_missing_or_outside_root'});stats.unscannedPlaces++;continue;}
  try {
    const parsed=inspectReferences(file,fs.readFileSync(file));
    if(!['xml_text','binary_decoded'].includes(parsed.coverage))diagnostics.push({place:placeId,reason:parsed.coverage,unsupported:parsed.unsupportedProperties?.slice(0,12)});
    stats.scannedPlaces++;
    if(!['xml_text','binary_decoded'].includes(parsed.coverage))stats.unscannedPlaces++;
    for(const id of parsed.ids)remember(id,placeId,0,null);
  }catch(error){diagnostics.push({place:placeId,reason:error.code||error.message});}
}

while(queue.length) {
  const task=queue.shift();
  const record=ids.get(task.id);
  if(!record)continue;
  let found=resolver.lookup(task.id);
  let downloaded=false;
  if(!found && opts.download && stats.upstreamAttempts<opts.maxFetch) {
    stats.upstreamAttempts++;
    try {found=await resolver.resolve(task.id);downloaded=!!found;}
    catch(error){record.reason=error.code||'network_error';}
  }
  if(!found) {
    if(record.status==='pending') {
      record.status='missing';
      record.reason=record.reason||resolver.getFailureReason(task.id)||'not_locally_available';
    }
    continue;
  }
  if(record.status==='pending'||record.status==='missing') {
    try {
      const bytes=archiveAsset(record,found);
      record.status=downloaded?'downloaded':'local';
      delete record.reason;
      const deps=record.kind==='model'||record.kind==='text' ? inspectReferences(found.file,bytes) : null;
      record.scan=deps?.coverage||'not_a_model';
      record.dependencies=(deps?.ids||[]).filter(id=>id!==record.id);
    } catch(error) {
      record.status='error';record.reason=error.code||error.message;record.dependencies=[];
    }
  }
  if(task.depth<opts.maxDepth && record.dependencies) {
    for(const dep of record.dependencies) {
      if(dep===task.id)continue;
      stats.modelDependencies++;
      remember(dep,task.placeId,task.depth+1,task.id);
    }
  }
}
const records=[...ids.values()].sort((a,b)=>Number(a.id)-Number(b.id)).map(record=>({
  ...record,places:[...record.places].sort(),parents:[...record.parents].sort()
}));
for(const record of records) {
  if(record.status==='local'||record.status==='downloaded')stats[record.status]++;
  else if(record.status==='missing')stats.missing++;
  else stats.skipped++;
}
stats.assetReferences=records.length;
const generatedAt=new Date().toISOString();
for(const [placeId,linked] of perPlace) {
  const subset=[...linked].map(id=>ids.get(id)).filter(Boolean);
  const statuses={};
  for(const r of subset)statuses[r.status]=(statuses[r.status]||0)+1;
  atomicJson(path.join(reportsDir,placeId+'.json'),{
    schemaVersion:1,generatedAt,placeId,game:places[placeId]?.name||placeId,
    discoveredAssets:subset.length,statuses,
    complete:subset.length>0 && !diagnostics.some(d=>d.place===placeId) && subset.every(r=>r.status==='local'||r.status==='downloaded'),
    // 'complete' describes scanned references only: dynamic script IDs remain unknown.
    limitations:'Static scanning can miss dynamically computed IDs, compressed binary properties, and runtime-generated dependencies.',
    assets:subset.map(r=>({id:r.id,status:r.status,reason:r.reason||null})).sort((a,b)=>Number(a.id)-Number(b.id))
  });
}
atomicJson(indexPath,{
  schemaVersion:1,generatedAt,mode:opts.download?'seed_with_upstream':'offline_only',
  stats,diagnostics,
  assets:records
});
console.log(JSON.stringify({report:indexPath,perGameReports:reportsDir,stats,diagnostics:diagnostics.length},null,2));
