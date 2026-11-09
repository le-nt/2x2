#!/usr/bin/env node
/**
 * Import any user-owned RBXL/RBXLX into 2x2, then discover and optionally
 * retrieve its referenced assets. Does not depend on the historical catalog.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {looksLikeRobloxModel} from '../server/lib/asset-discovery.mjs';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const opts={root:project,download:!!process.env.ROBLOX_OPEN_CLOUD_API_KEY||process.env.ROBLOX_ASSET_FETCH==='1'||!!process.env.AYA_ASSET_FALLBACK_URL,maxFetch:100};
const argv=process.argv.slice(2);
for(let i=0;i<argv.length;i++){
  const a=argv[i];
  if(a==='--root')opts.root=path.resolve(argv[++i]);
  else if(a==='--file')opts.file=path.resolve(argv[++i]);
  else if(a==='--id')opts.id=argv[++i];
  else if(a==='--name')opts.name=argv[++i];
  else if(a==='--download')opts.download=true;
  else if(a==='--offline')opts.download=false;
  else if(a==='--max-fetch')opts.maxFetch=Number(argv[++i]);
  else throw Error('Unknown option '+a);
}
if(!opts.file||!opts.id||!/^[a-z0-9-]{1,100}$/.test(opts.id))
  throw Error('Usage: node tools/import-any-native.mjs --file "path/to/map.rbxl" --id my-game [--name "Game name"] [--offline]');
if(!Number.isSafeInteger(opts.maxFetch)||opts.maxFetch<0||opts.maxFetch>500)
  throw Error('Invalid --max-fetch (0–500)');
const stat=fs.statSync(opts.file);
if(!stat.isFile()||stat.size>128*1024*1024||stat.size===0)throw Error('Map must be a nonempty file <=128 MiB');
if(!/\.rbxlx?$/i.test(opts.file))throw Error('Input must be .rbxl or .rbxlx');
const bytes=fs.readFileSync(opts.file);
if(!looksLikeRobloxModel(bytes))throw Error('Not a recognizable Roblox XML/binary place file');
const python=process.env.RBX_PYTHON||(process.platform==='win32'?'py':'python3');
const analyzer=path.join(project,'tools/analyze-place.py');
const analyzed=spawnSync(python,[analyzer,opts.file],{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024,windowsHide:true});
if(analyzed.status!==0)throw Error('Place validation failed: '+(analyzed.stderr||analyzed.error?.code||'analyzer_failed').slice(0,240));
const analysis=JSON.parse(analyzed.stdout);
if(!analysis.valid)throw Error('Place analyzer did not confirm structural validity');
const native=path.join(opts.root,'server/native');
const maps=path.join(native,'maps');
const registry=path.join(native,'places.json');
// Serialize ID allocation and registry publication across importer processes.
// A stale lock after interruption requires explicit operator inspection.
const lockFile=registry+'.import.lock';
const lock=fs.openSync(lockFile,'wx');
try {
const original=JSON.parse(fs.readFileSync(registry,'utf8'));
if(!original.places||typeof original.places!=='object')throw Error('Invalid place registry');
const places=original.places;
const hash=crypto.createHash('sha256').update(bytes).digest('hex');
if(analysis.sha256!==hash)throw Error('Input changed during analysis; retry import');
const previous=places[opts.id];
if(previous && previous.sha256 && previous.sha256!==hash)
  throw Error('Game ID already exists with different map bytes; choose another ID or import through an explicit update workflow');
if(previous && !previous.sha256)throw Error('Existing game lacks import hash; refusing to replace it');
const fileName=opts.id+'.rbxl';
const destination=path.join(maps,fileName);
fs.mkdirSync(maps,{recursive:true});
if(fs.existsSync(destination)){
  const existingHash=crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
  if(existingHash!==hash)throw Error('Destination map already exists with different bytes');
} else {
  const tmp=destination+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(tmp,bytes,{flag:'wx'});fs.renameSync(tmp,destination);}
  finally{try{fs.unlinkSync(tmp);}catch{}}
}
const nextId=Math.max(0,...Object.values(places).map(v=>Number(v.id)||0))+1;
if(nextId>=2147483647)throw Error('Place ID range exhausted');
places[opts.id]={...previous,id:previous?.id||nextId,file:fileName,name:opts.name||previous?.name||opts.id,sha256:hash};
const temp=registry+'.'+crypto.randomUUID()+'.tmp';
try{fs.writeFileSync(temp,JSON.stringify(original,null,2)+'\n');fs.renameSync(temp,registry);}
finally{try{fs.unlinkSync(temp);}catch{}}
const args=[path.join(project,'tools/seed-native-assets.mjs'),'--root',opts.root,'--place',opts.id];
if(opts.download&&opts.maxFetch)args.push('--download','--max-fetch',String(opts.maxFetch));
const run=spawnSync(process.execPath,args,{cwd:opts.root,stdio:'inherit',windowsHide:true});
if(run.status!==0)throw Error('Import saved, but asset seeding failed; rerun tools/seed-native-assets.mjs --place '+opts.id);
console.log('Imported',opts.id,'native place ID',places[opts.id].id);
console.log('Coverage: server/native/asset-reports/'+opts.id+'.json');
const reportFile=path.join(native,'asset-reports',opts.id+'.json');
const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));
report.placeAnalysis=analysis;
report.compatibilityStatus=report.complete?'dependencies_resolved':'dependencies_partially_resolved';
const reportTemp=reportFile+'.'+crypto.randomUUID()+'.tmp';
try{fs.writeFileSync(reportTemp,JSON.stringify(report,null,2)+'\n',{flag:'wx'});fs.renameSync(reportTemp,reportFile);}
finally{try{fs.unlinkSync(reportTemp);}catch{}}
} finally {fs.closeSync(lock);fs.unlinkSync(lockFile);}
