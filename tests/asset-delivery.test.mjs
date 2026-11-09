import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createServer} from 'node:http';
import {fetchRobloxLegacyAsset,fetchRobloxOpenCloudAsset,retryAfterMs} from '../server/lib/roblox-open-cloud.mjs';
import {createAssetResolver} from '../server/lib/asset-resolver.mjs';

function environment(t,values={}) {
 const names=['ROBLOX_OPEN_CLOUD_API_KEY','ROBLOX_ASSET_FETCH','ROBLOX_ASSET_DELIVERY_PREFERENCE','AYA_ASSET_FALLBACK_URL','AYA_ASSETS_DIR','ASSET_PERSIST_DOWNLOADS'];
 const previous=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 for(const name of names)delete process.env[name];
 Object.assign(process.env,{ROBLOX_ASSET_FETCH:'1',...values});
 t.after(()=>{for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}});
}
function fixture(t,options={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-delivery-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const config={serverDir:path.join(root,'server'),siteDir:path.join(root,'site'),...options};
 return {root,config,resolver:createAssetResolver(config)};
}
function identity(id,version=1){return {'roblox-assetid':id,'roblox-assetversionnumber':String(version),'roblox-assettypeid':'4'};}
function delivery(requests,{latest=2}={}){
 return async(url,options)=>{
  const u=new URL(url);requests.push({url:u,headers:options.headers});
  if(u.hostname.endsWith('rbxcdn.com'))return new Response('version '+u.searchParams.get('v')+' payload');
  const id=u.pathname.split('/assetId/')[1]?.split('/')[0]||u.searchParams.get('id');
  const version=Number(u.pathname.match(/\/version\/(\d+)$/)?.[1]||u.searchParams.get('version')||latest);
  return Response.json({location:'https://files.rbxcdn.com/original?id='+id+'&v='+version,assetTypeId:4},{headers:identity(id,version)});
 };
}

test('legacy v1 metadata and direct redirects retain verified identity without credentials',async()=>{
 for(const endpoint of ['location','bytes']){
  const requests=[];
  const fetchImpl=async(url,options)=>{
   requests.push({url,headers:options.headers});
   if(requests.length===1)return endpoint==='location'?Response.json({location:'https://files.rbxcdn.com/data',assetTypeId:4},{headers:identity('123',7)}):new Response(null,{status:302,headers:{...identity('123',7),location:'https://files.rbxcdn.com/data'}});
   return new Response('original bytes');
  };
  const result=await fetchRobloxLegacyAsset('123',{endpoint,version:7,key:'must-not-leave',fetchImpl});
  assert.equal(result.bytes.toString(),'original bytes');assert.equal(result.metadata.assetVersionNumber,7);
  assert.equal(result.metadata.assetId,'123');assert.equal(result.metadata.assetTypeId,4);
  assert.equal(result.metadata.versionVerified,true);assert.equal(result.metadata.identityVerified,true);
  assert.ok(requests.every(r=>!r.headers.cookie&&!r.headers['x-api-key']));
 }
});

test('identity/version mismatches, error envelopes and untrusted locations never become asset bytes',async()=>{
 for(const headers of [identity('999',1),identity('123',2)]){
  let calls=0;
  const result=await fetchRobloxLegacyAsset('123',{version:1,fetchImpl:async()=>{calls++;return Response.json({location:'https://files.rbxcdn.com/data'},{headers});}});
  assert.equal(result.reason,'asset_identity_mismatch');assert.equal(calls,1);
 }
 for(const code of [401,403,404,429]){
  const result=await fetchRobloxLegacyAsset('123',{fetchImpl:async()=>Response.json({errors:[{code}]},{headers:{'retry-after':'3'}})});
  assert.equal(result.status,code);assert.equal(result.bytes,undefined);
  assert.equal(result.reason,code===429?'upstream_rate_limited':code===404?'upstream_not_found':'upstream_auth_required');
 }
 const result=await fetchRobloxLegacyAsset('123',{fetchImpl:async()=>Response.json({location:'https://example.org/data'})});
 assert.equal(result.reason,'untrusted_redirect');
 const noVersion=await fetchRobloxLegacyAsset('123',{version:1,fetchImpl:async()=>new Response('unverified bytes')});
 assert.equal(noVersion.reason,'asset_version_unverified');
});

test('Retry-After honors seconds, HTTP dates and server clock skew',()=>{
 assert.equal(retryAfterMs(new Headers({'retry-after':'2'})),2000);
 assert.equal(retryAfterMs(new Headers({'retry-after':'Thu, 01 Jan 2026 00:00:10 GMT','date':'Thu, 01 Jan 2026 00:00:00 GMT'}),0),10000);
 assert.equal(retryAfterMs(new Headers({'retry-after':'invalid'})),60000);
});

test('persistent original bytes and version metadata survive cache removal and resolver restart',async t=>{
 environment(t);const requests=[];const {root,config,resolver}=fixture(t,{fetchImpl:delivery(requests)});
 const [a,b]=await Promise.all([resolver.resolve('123',{version:1}),resolver.resolve('123',{version:'1'})]);
 assert.equal(a.file,b.file);assert.equal(requests.length,2,'One metadata request and one CDN download');
 assert.equal(a.metadata.assetVersionNumber,1);assert.equal(a.metadata.requestedVersion,1);
 assert.match(a.file,/asset-seed/);
 const newer=await resolver.resolve('123',{version:2});assert.notEqual(newer.file,a.file);
 assert.notDeepEqual(fs.readFileSync(newer.file),fs.readFileSync(a.file));
 const latest=await resolver.resolve('123');assert.equal(latest.metadata.assetVersionNumber,2);
 assert.equal(requests.filter(r=>r.url.hostname.endsWith('rbxcdn.com')).length,2,'Known version bytes are reused after latest identity lookup');
 const native=path.join(root,'server/native');fs.rmSync(path.join(native,'asset-cache'),{recursive:true,force:true});
 const restarted=createAssetResolver({...config,fetchImpl:async()=>{throw Error('Archive hits must not request the network');}});
 assert.equal(fs.readFileSync((await restarted.resolve('123',{version:1})).file).toString(),'version 1 payload');
 assert.equal((await restarted.resolve('123')).metadata.sha256,latest.metadata.sha256);
 const serialized=fs.readFileSync(path.join(native,'asset-metadata/123.v1.json'),'utf8');
 assert.ok(!serialized.includes('files.rbxcdn.com'),'Signed CDN locations are not retained');
 assert.equal(JSON.parse(serialized).bytes,a.size);
});

test('unversioned archive bytes cannot silently satisfy pinned versions',async t=>{
 environment(t);const requests=[];const {root,resolver}=fixture(t,{fetchImpl:delivery(requests)});
 const directory=path.join(root,'server/native/asset-seed');fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'123.mesh'),'original unversioned archive');
 const pinned=await resolver.resolve('123',{version:1});
 assert.equal(pinned.metadata.assetVersionNumber,1);
 assert.equal(fs.readFileSync(path.join(directory,'123.mesh'),'utf8'),'original unversioned archive');
 assert.equal((await resolver.resolve('123')).metadata,null);
 assert.equal(requests.length,2);
});

test('simultaneous latest and pinned requests share the verified version CDN transfer',async t=>{
 environment(t);const requests=[];const {resolver}=fixture(t,{fetchImpl:delivery(requests)});
 const [latest,pinned]=await Promise.all([resolver.resolve('123'),resolver.resolve('123',{version:2})]);
 assert.equal(latest.metadata.sha256,pinned.metadata.sha256);
 assert.equal(requests.filter(r=>r.url.hostname.endsWith('rbxcdn.com')).length,1);
});

test('a provider cooldown applies to other IDs and both public v1 routes',async t=>{
 environment(t);let time=10000,rateLimited=true;const requests=[];
 const success=delivery(requests);
 const {resolver}=fixture(t,{clock:()=>time,fetchImpl:async(url,options)=>rateLimited?(requests.push({url:new URL(url),headers:options.headers}),new Response(null,{status:429,headers:{'retry-after':'2'}})):success(url,options)});
 assert.equal(await resolver.resolve('123'),null);assert.equal(requests.length,1);
 assert.equal(await resolver.resolve('456'),null);assert.equal(requests.length,1);
 assert.equal(resolver.getFailureReason('456'),'upstream_rate_limited');
 time=11999;assert.equal(await resolver.resolve('456'),null);assert.equal(requests.length,1);
 time=12001;rateLimited=false;assert.ok(await resolver.resolve('456'));assert.equal(requests.length,3);
});

test('public-first preference retains scoped Open Cloud fallback without sending keys to legacy/CDN',async t=>{
 environment(t,{ROBLOX_OPEN_CLOUD_API_KEY:'server-only-key',ROBLOX_ASSET_DELIVERY_PREFERENCE:'legacy_v1'});
 const requests=[];
 const {resolver}=fixture(t,{fetchImpl:async(url,options)=>{
  const u=new URL(url);requests.push({url:u,headers:options.headers});
  if(u.hostname==='assetdelivery.roblox.com')return Response.json({errors:[{code:401}]});
  if(u.hostname==='apis.roblox.com')return Response.json({location:'https://files.rbxcdn.com/data'},{headers:identity('123')});
  return new Response('permitted bytes');
 }});
 assert.ok(await resolver.resolve('123'));assert.equal(requests[0].url.hostname,'assetdelivery.roblox.com');
 assert.deepEqual(requests[0].headers,{});assert.equal(requests[1].headers['x-api-key'],'server-only-key');
 assert.deepEqual(requests[2].headers,{});
});

test('legacy HTTP routes honor version pins and reject malformed versions',async t=>{
 environment(t);const requests=[];const {resolver}=fixture(t,{fetchImpl:delivery(requests)});
 const server=createServer((req,res)=>{if(!resolver.handle(req,res,new URL(req.url,'http://localhost')))res.writeHead(404).end();});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();server.close();});
 const base='http://127.0.0.1:'+server.address().port;
 assert.equal(await (await fetch(base+'/asset?id=123&version=1')).text(),'version 1 payload');
 assert.equal(await (await fetch(base+'/asset?id=123&version=2')).text(),'version 2 payload');
 assert.equal((await fetch(base+'/asset?id=123&version=../1')).status,400);
 assert.equal((await fetch(base+'/asset?id=123&version=0')).status,400);
});

test('local asset responses preserve rate-limit status and Retry-After without retry storms',async t=>{
 environment(t);let calls=0;
 const {resolver}=fixture(t,{fetchImpl:async()=>{calls++;return new Response(null,{status:429,headers:{'retry-after':'3'}});}});
 const server=createServer((req,res)=>resolver.handle(req,res,new URL(req.url,'http://localhost')));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();server.close();});
 const base='http://127.0.0.1:'+server.address().port;
 for(const id of ['123','456']) {
  const response=await fetch(base+'/asset?id='+id);
  assert.equal(response.status,429);assert.ok(Number(response.headers.get('retry-after'))>=1);
  assert.equal((await response.json()).reason,'upstream_rate_limited');
 }
 assert.equal(calls,1);
});

test('a legitimate JSON asset is retained after a signed location, while CDN error documents are rejected',async()=>{
 for(const invalid of [false,true]) {
  let calls=0;
  const result=await fetchRobloxOpenCloudAsset('123',{key:'server-only',fetchImpl:async()=>++calls===1?
   Response.json({location:'https://files.rbxcdn.com/data'}):Response.json(invalid?{errors:[{code:403}]}:{asset:{version:'2.0'},nodes:[]})});
  if(invalid)assert.equal(result.reason,'upstream_error_envelope');
  else assert.deepEqual(JSON.parse(result.bytes.toString()),{asset:{version:'2.0'},nodes:[]});
 }
});
