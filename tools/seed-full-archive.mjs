#!/usr/bin/env node
/**
 * Orchestrates offline seeding + verified Novetus recovery + optional proxy.
 * All network activity requires an explicit flag. Never edits RBXL maps.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let root=project,novetus=0,proxy=0,maxAssets=10000,maxDepth=4,place=null;
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++) {
  const flag=args[i];
  if(flag==='--root')root=path.resolve(args[++i]);
  else if(flag==='--place')place=args[++i];
  else if(['--novetus','--proxy','--max-assets','--max-depth'].includes(flag)) {
    const n=Number(args[++i]);
    if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid '+flag);
    if(flag==='--novetus')novetus=n;
    if(flag==='--proxy')proxy=n;
    if(flag==='--max-assets')maxAssets=n;
    if(flag==='--max-depth')maxDepth=n;
  } else throw Error('Unexpected argument: '+flag);
}
if(novetus>250||proxy>1000||maxAssets>100000||maxDepth>12)
  throw Error('Safety limit exceeded');
if(place && !/^[a-z0-9-]{1,150}$/.test(place))throw Error('Invalid place');
const python=process.env.RBX_PYTHON||(process.platform==='win32'?'py':'python3');
function run(command,args,opts={}) {
  const extra=process.platform==='win32'&&python==='py'&&command===python?['-3']:null;
  const result=spawnSync(command,[...(extra||[]),...args],{cwd:root,stdio:'inherit',timeout:opts.timeout||0,windowsHide:true});
  if(result.error||result.status!==0)
    throw Error('Command failed: '+command+' '+args[0]+', '+(result.error?.message||result.status));
}
const seederArgs=['--root',root,'--max-assets',String(maxAssets),'--max-depth',String(maxDepth)];
if(place)seederArgs.push('--place',place);
function seed(extra=[]) {run(process.execPath,[path.join(project,'tools/seed-native-assets.mjs'),...seederArgs,...extra]);}
function missingReport() {
  const index=JSON.parse(fs.readFileSync(path.join(root,'server/native/asset-index.json'),'utf8'));
  const missing=index.assets.filter(row=>row.status==='missing'||row.status==='error');
  const rows=missing.map(row=>({id:row.id,placesNeeding:row.places.length,examplePlaces:row.places.slice(0,5)}))
    .sort((a,b)=>b.placesNeeding-a.placesNeeding||Number(a.id)-Number(b.id));
  const folder=path.join(root,'server/native/asset-recovery');
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'missing-assets.json'),JSON.stringify({
    schemaVersion:1,source:'recursive-asset-index',generatedAt:new Date().toISOString(),assets:rows},null,2)+'\n');
  console.log('[seed-all] Missing unique IDs:',rows.length);
  return rows.length;
}
seed();
const missingCount=missingReport();
if(novetus&&missingCount) {
  console.log('[seed-all] Fetching up to',novetus,'verified assets from Novetus assetdelivery...');
  run(python,[path.join(project,'tools/import-novetus-assets.py'),'--root',root,'--fetch','--limit',String(novetus)]);
  const staging=path.join(root,'server/native/asset-recovery/novetus-staging');
  if(fs.existsSync(staging)) {
    run(python,[path.join(project,'tools/asset-cache-manager.py'),'--root',root,'--import-from',staging,'--apply']);
    seed();
    missingReport();
  }
}
if(proxy) {
  console.log('[seed-all] Fetching at most',proxy,'additional IDs from configured upstream...');
  seed(['--download','--max-fetch',String(proxy)]);
  missingReport();
}
console.log('[seed-all] Done. Review server/native/asset-index.json and asset-reports/.');
