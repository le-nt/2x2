// Best-effort launch-time prefetch of already discovered map assets.
// Non-blocking, bounded, deduplicated across simultaneous launches.
// Never blocks player joins or downloads assets without an approved resolver.
import fs from 'node:fs';
import path from 'node:path';
import {validAssetVersion} from './asset-resolver.mjs';

export function createNativeAssetPrefetch({serverDir,assetResolver,maxPerLaunch=24,concurrency=2,logger=console}){
  const perLaunch=Math.min(100,Math.max(0,Math.trunc(maxPerLaunch)));
  const cap=Math.min(4,Math.max(1,Math.trunc(concurrency)));
  const pending=new Set(),queue=[];
  const placeCooldown=new Map();
  let active=0;
  let stopped=false;
  const validId=id=>typeof id==='string' && /^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id));
  const validPlace=s=>typeof s==='string' && /^[a-zA-Z0-9_-]{1,120}$/.test(s);
  function pump(){
    while(!stopped && active<cap && queue.length){
      const {id,version,key}=queue.shift();
      active++;
      Promise.resolve().then(()=>assetResolver.resolve(id,{version})).catch(err=>{
        logger.warn?.('[2x2 prefetch] Failed',id,err.message);
      }).finally(()=>{pending.delete(key);active--;pump();});
    }
  }
  function launch(place){
    const upstreamConfigured=process.env.ROBLOX_OPEN_CLOUD_API_KEY || process.env.ROBLOX_ASSET_FETCH==='1' || process.env.AYA_ASSET_FALLBACK_URL;
    if(stopped||!assetResolver||!validPlace(place)||!perLaunch||!upstreamConfigured)return 0;
    // Multiple players launching one place should not extend the queue repeatedly.
    if((placeCooldown.get(place)||0)>Date.now())return 0;
    const file=path.join(serverDir,'native','asset-reports',place+'.json');
    let report;
    try{report=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return 0;}
    if(report.placeId!==place || !Array.isArray(report.assets))return 0;
    let added=0;
    for(const item of report.assets){
      const id=item?.id;
      const version=item?.version??null,key=version===null?id:id+'.v'+version;
      if(!validId(id)||!validAssetVersion(version)|| !['missing','skipped','pending','deferred'].includes(item.status) || pending.has(key))continue;
      if(assetResolver.lookup(id,{version}))continue;
      if(queue.length>=128 || added>=perLaunch)break;
      pending.add(key);
      queue.push({id,version,key});
      added++;
    }
    if(added){
      if(placeCooldown.size>=1024)placeCooldown.delete(placeCooldown.keys().next().value);
      placeCooldown.set(place,Date.now()+5*60*1000);
      logger.log?.('[2x2 prefetch]',place,'queued',added,'missing assets');
    }
    pump();
    return added;
  }
  function stats(){return {active,queued:queue.length,pending:pending.size};}
  function stop(){stopped=true;queue.length=0;}
  return {launch,stats,stop};
}
