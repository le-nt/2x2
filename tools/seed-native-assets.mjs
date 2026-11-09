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
import {scanAssetReferences,scanResourceReferences,looksLikeRobloxModel,validAssetId} from '../server/lib/asset-discovery.mjs';
import {canonicalResource,safeArchiveFile} from '../server/lib/asset-vfs.mjs';
import {prepareAssetVfs} from './prepare-asset-vfs.mjs';

const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function flags(argv) {
  const options={download:false,maxFetch:250,maxAssets:10000,maxDepth:4,maxDurationMs:300000,place:null,root:null};
  for (let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if (arg==='--download') options.download=true;
    else if (arg==='--place') options.place=argv[++i];
    else if (arg==='--root') options.root=argv[++i];
    else if (['--max-fetch','--max-assets','--max-depth','--max-duration-ms'].includes(arg)) {
      const n=Number(argv[++i]);
      if (!Number.isSafeInteger(n)||n<0) throw Error('Invalid value for '+arg);
      options[arg==='--max-fetch'?'maxFetch':arg==='--max-assets'?'maxAssets':arg==='--max-depth'?'maxDepth':'maxDurationMs']=n;
    } else throw Error('Unknown option: '+arg);
  }
  if (options.maxAssets>100000 || options.maxFetch>10000 || options.maxDepth>12 || options.maxDurationMs>600000)
    throw Error('Safety limit exceeded');
  return options;
}
const opts=flags(process.argv.slice(2));
const root=opts.root?path.resolve(opts.root):defaultRoot;
const python=process.env.RBX_PYTHON||(process.platform==='win32'?'py':'python3');
const serverDir=path.join(root,'server');
const nativeDir=path.join(serverDir,'native');
const mapDir=path.join(nativeDir,'maps');
const seedDir=path.join(nativeDir,'asset-seed');
const reportsDir=path.join(nativeDir,'asset-reports');
const indexPath=path.join(nativeDir,opts.place ? 'asset-index.'+opts.place+'.json' : 'asset-index.json');
const resolver=createAssetResolver({serverDir,siteDir:path.join(root,'site')});
const archiveVfs=await prepareAssetVfs(root);
const resourcesByPlace=new Map();
const analysesByPlace=new Map();
const places=JSON.parse(fs.readFileSync(path.join(nativeDir,'places.json'),'utf8')).places;
if (opts.place && !Object.hasOwn(places,opts.place)) throw Error('Unknown place ID: '+opts.place);

const ids=new Map();
const perPlace=new Map();
const diagnostics=[];
const stats={scannedPlaces:0,unscannedPlaces:0,assetReferences:0,local:0,downloaded:0,missing:0,skipped:0,modelDependencies:0,upstreamAttempts:0};
const queue=[];
const visited=new Set();
const cappedPlaces=new Set();
let totalUnique=0;

function remember(id,placeId,depth,parent) {
  if (!validAssetId(id)) return;
  if (!perPlace.has(placeId)) perPlace.set(placeId,new Set());
  perPlace.get(placeId).add(id);
  if (!ids.has(id)) {
    if (totalUnique>=opts.maxAssets) {stats.skipped++;cappedPlaces.add(placeId);return;}
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
  if(!looksLikeRobloxModel(bytes))return {...first,coverage:'text_literals'};
  const analyzer=path.join(defaultRoot,'tools','analyze-place.py');
  const args=process.platform==='win32'&&python==='py'?['-3',analyzer,file]:[analyzer,file];
  const run=spawnSync(python,args,{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024,windowsHide:true});
  if(run.status!==0) return {...first,coverage:'model_analysis_failed',error:(run.stderr||run.error?.code||'analyzer_unavailable').slice(0,180)};
  try {
    const decoded=JSON.parse(run.stdout);
    return {...first,ids:[...new Set([...first.ids,...decoded.assetIds.filter(validAssetId)])].sort((a,b)=>Number(a)-Number(b)),
      coverage:decoded.format==='binary'?'binary_decoded_partial':'xml_text',analysis:decoded,
      resourceReferences:decoded.resourceReferences||[],
      unsupportedProperties:decoded.unsupportedBinaryProperties};
  } catch(error){return {...first,coverage:'model_analyzer_invalid_response'};}
}
function rememberResources(placeId,references,parentAsset=null) {
  if(!resourcesByPlace.has(placeId))resourcesByPlace.set(placeId,new Map());
  const resources=resourcesByPlace.get(placeId);
  for(const reference of references) {
    if(!canonicalResource(reference)||resources.has(reference))continue;
    if(resources.size>=opts.maxAssets){cappedPlaces.add(placeId);break;}
    const result=archiveVfs?.resolve(reference)||{status:'not_inventoried'};
    resources.set(reference,{reference,parentAsset,status:result.status,sha256:result.sha256||null,rootId:result.rootId||null,
      ...(result.mapping?{mapping:result.mapping}:{})});
  }
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

// These are the engine's character bootstrap models (Network/Player.cpp),
// independent of any particular archived place. Discover their original IDs
// from the shipped models instead of maintaining guessed ID substitutions.
const runtimeModels=[];
const unavailableRuntimeModels=[];
const runtimeContent=path.join(root,'services/engine/.assets/content');
for(const resource of ['fonts/humanoidAnimateLocalKeyframe2.rbxm','fonts/humanoidAnimateR15.rbxm',
  'fonts/humanoidSoundNewLocal.rbxmx','fonts/humanoidHealthRegenScript.rbxm']) {
  let found=safeArchiveFile(runtimeContent,resource),source='packaged_runtime';
  if(!found) {
    const archived=archiveVfs?.resolve('rbxasset://'+resource);
    if(archived?.status==='resolved') {
      found={file:archived.file,stat:fs.statSync(archived.file)};source='asset_vfs';
    }
  }
  if(!found || found.stat.size>2*1024*1024){unavailableRuntimeModels.push(resource);continue;}
  const bytes=fs.readFileSync(found.file),parsed=inspectReferences(found.file,bytes);
  runtimeModels.push({resource,source,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    assetIds:parsed.ids,coverage:parsed.coverage,resourceReferences:parsed.resourceReferences||[]});
}

for(const [placeId,entry] of Object.entries(places)) {
  if(opts.place && opts.place!==placeId)continue;
  perPlace.set(placeId,new Set());
  const file=safeMap(entry.file);
  if (!file) {diagnostics.push({place:placeId,reason:'map_missing_or_outside_root'});stats.unscannedPlaces++;continue;}
  try {
    const mapBytes=fs.readFileSync(file);
    const parsed=inspectReferences(file,mapBytes);
    for(const model of runtimeModels) {
      rememberResources(placeId,['rbxasset://'+model.resource,...model.resourceReferences]);
      for(const id of model.assetIds)remember(id,placeId,0,null);
    }
    analysesByPlace.set(placeId,parsed.analysis||null);
    rememberResources(placeId,[...scanResourceReferences(mapBytes).references,...(parsed.resourceReferences||[])]);
    if(!['xml_text','binary_decoded'].includes(parsed.coverage))diagnostics.push({place:placeId,reason:parsed.coverage,unsupported:parsed.unsupportedProperties?.slice(0,12)});
    stats.scannedPlaces++;
    if(!['xml_text','binary_decoded'].includes(parsed.coverage))stats.unscannedPlaces++;
    for(const id of parsed.ids)remember(id,placeId,0,null);
  }catch(error){diagnostics.push({place:placeId,reason:error.code||error.message});}
}

const fetchDeadline=performance.now()+opts.maxDurationMs;
while(queue.length) {
  const task=queue.shift();
  const record=ids.get(task.id);
  if(!record)continue;
  let found=resolver.lookup(task.id);
  let downloaded=false;
  if(!found && opts.download && performance.now()>=fetchDeadline) {
    if(record.status==='pending') {
      record.status='deferred';record.reason='upstream_time_budget_exhausted';
    }
    cappedPlaces.add(task.placeId);
  }
  if(!found && opts.download && performance.now()<fetchDeadline && stats.upstreamAttempts<opts.maxFetch) {
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
      record.resourceReferences=deps?.resourceReferences||(record.kind==='text'?scanResourceReferences(bytes).references:[]);
      record.dependencies=(deps?.ids||[]).filter(id=>id!==record.id);
    } catch(error) {
      record.status='error';record.reason=error.code||error.message;record.dependencies=[];
    }
  }
  rememberResources(task.placeId,record.resourceReferences||[],task.id);
  if(!['not_a_model','xml_text','text_literals'].includes(record.scan))
    diagnostics.push({place:task.placeId,asset:record.id,reason:record.scan||'model_not_scanned'});
  if(task.depth===opts.maxDepth && record.dependencies?.some(id=>!visited.has(task.placeId+':'+id)))
    cappedPlaces.add(task.placeId);
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
    resourceReferences:[...(resourcesByPlace.get(placeId)?.values()||[])],
    placeAnalysis:analysesByPlace.get(placeId)||null,
    nativeRuntimeDependencies:{models:runtimeModels,unavailableModels:unavailableRuntimeModels},
    resourceCoverage:archiveVfs?'manifest_lookup':'not_inventoried',
    gameplayStatus:'not_tested',
    discoveredAssets:subset.length,statuses,
    complete:!cappedPlaces.has(placeId) && !diagnostics.some(d=>d.place===placeId) && subset.every(r=>r.status==='local'||r.status==='downloaded') && [...(resourcesByPlace.get(placeId)?.values()||[])].every(r=>r.status==='resolved'),
    truncated:cappedPlaces.has(placeId),
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
