// Best-effort launch-time prefetch of already discovered map assets.
// Non-blocking, bounded, deduplicated across simultaneous launches.
// Never blocks player joins or downloads assets without an approved resolver.
import fs from 'node:fs';
import path from 'node:path';

export function createNativeAssetPrefetch({serverDir,assetResolver,maxPerLaunch=24,concurrency=2,logger=console}){
  const perLaunch=Math.min(100,Math.max(0,Math.trunc(maxPerLaunch)));
  const cap=Math.min(4,Math.max(1,Math.trunc(concurrency)));
  const pending=new Set(),queue=[];
  let active=0;
  let stopped=false;
  const validId=id=>typeof id==='string' && /^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id));
  const validPlace=s=>typeof s==='string' && /^[a-zA-Z0-9_-]{1,120}$/.test(s);
  function pump(){
    while(!stopped && active<cap && queue.length){
      const id=queue.shift();
      active++;
      Promise.resolve().then(()=>assetResolver.resolve(id)).catch(err=>{
        logger.warn?.('[2x2 prefetch] Failed',id,err.message);
      }).finally(()=>{pending.delete(id);active--;pump();});
    }
  }
  function launch(place){
    if(stopped||!assetResolver||!validPlace(place)||!perLaunch||!process.env.ROBLOX_OPEN_CLOUD_API_KEY)return 0;
    const file=path.join(serverDir,'native','asset-reports',place+'.json');
    let report;
    try{report=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return 0;}
    if(report.placeId!==place || !Array.isArray(report.assets))return 0;
    let added=0;
    for(const item of report.assets){
      const id=item?.id;
      if(!validId(id)|| !['missing','skipped','pending'].includes(item.status) || pending.has(id))continue;
      if(assetResolver.lookup(id))continue;
      if(queue.length>=128 || added>=perLaunch)break;
      pending.add(id);
      queue.push(id);
      added++;
    }
    if(added)logger.log?.('[2x2 prefetch]',place,'queued',added,'missing assets');
    pump();
    return added;
  }
  function stats(){return {active,queued:queue.length,pending:pending.size};}
  function stop(){stopped=true;queue.length=0;}
  return {launch,stats,stop};
}
