import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createNativeAssetPrefetch} from '../server/lib/native-asset-prefetch.mjs';

test('prefetch uses verified per-game IDs, deduplicates launches and keeps queue bounded',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-prefetch-'));
 const dir=path.join(temp,'native/asset-reports');
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'example.json'),JSON.stringify({placeId:'example',assets:[
  {id:'101',status:'missing'},{id:'101',status:'missing'}, {id:'102',status:'local'},
  {id:'103',status:'missing'},{id:'../104',status:'missing'},{id:'105',status:'missing'}]}));
 const before=process.env.ROBLOX_OPEN_CLOUD_API_KEY;
 process.env.ROBLOX_OPEN_CLOUD_API_KEY='unit-test-only';
 const seen=[];
 let release;
 const gate=new Promise(resolve=>release=resolve);
 const resolver={lookup:()=>null,resolve:async id=>{seen.push(id);await gate;return null;}};
 try{
  const p=createNativeAssetPrefetch({serverDir:temp,assetResolver:resolver,maxPerLaunch:2,concurrency:1,logger:{log(){},warn(){}}});
  assert.equal(p.launch('../example'),0);
  assert.equal(p.launch('example'),2);
  assert.equal(p.launch('example'),0);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(seen,['101']);
  release();
  for(let i=0;i<30 && p.stats().pending;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual(seen,['101','103']);
  assert.deepEqual(p.stats(),{active:0,queued:0,pending:0});
 }finally{
  if(before===undefined)delete process.env.ROBLOX_OPEN_CLOUD_API_KEY;
  else process.env.ROBLOX_OPEN_CLOUD_API_KEY=before;
  fs.rmSync(temp,{recursive:true,force:true});
 }
});

test('explicit public retrieval can prefetch without a Cloud key and offline mode stays offline',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-public-prefetch-'));
 const directory=path.join(temp,'native/asset-reports');fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'example.json'),JSON.stringify({placeId:'example',assets:[{id:'182393478',status:'missing'}]}));
 const names=['ROBLOX_OPEN_CLOUD_API_KEY','AYA_ASSET_FALLBACK_URL','ROBLOX_ASSET_FETCH'];
 const before=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 try {
  delete process.env.ROBLOX_OPEN_CLOUD_API_KEY;delete process.env.AYA_ASSET_FALLBACK_URL;
  process.env.ROBLOX_ASSET_FETCH='0';const seen=[];
  const p=createNativeAssetPrefetch({serverDir:temp,assetResolver:{lookup:()=>null,resolve:async id=>{seen.push(id);return null;}},logger:{log(){},warn(){}}});
  assert.equal(p.launch('example'),0);assert.deepEqual(seen,[]);
  process.env.ROBLOX_ASSET_FETCH='1';assert.equal(p.launch('example'),1);
  for(let i=0;i<20 && p.stats().pending;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.deepEqual(seen,['182393478']);
 } finally {
  for(const name of names)if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];
  fs.rmSync(temp,{recursive:true,force:true});
 }
});
