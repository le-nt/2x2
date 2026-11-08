import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fetchRobloxOpenCloudAsset} from '../server/lib/roblox-open-cloud.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('Open Cloud disabled without a key',async()=>{
  assert.equal((await fetchRobloxOpenCloudAsset('123',{key:''})).reason,'open_cloud_not_configured');
});
test('Open Cloud fetches raw bytes with server-only x-api-key',async()=>{
  const seen=[];
  const fetchImpl=async(url,options)=>{
    seen.push({url,headers:options.headers});
    return new Response(Buffer.from([1,2,3,4]),{headers:{'content-type':'application/octet-stream'}});
  };
  const result=await fetchRobloxOpenCloudAsset('123',{key:'test-secret',fetchImpl});
  assert.deepEqual(result.bytes,Buffer.from([1,2,3,4]));
  assert.equal(seen[0].headers['x-api-key'],'test-secret');
  assert.match(seen[0].url,/asset-delivery-api\/v1\/assetId\/123$/);
});
test('signed CDN location never receives API credentials',async()=>{
  const seen=[];
  const fetchImpl=async(url,options)=>{
    seen.push({url,headers:options.headers});
    if(seen.length===1)return Response.json({location:'https://content.rbxcdn.com/test-file'});
    return new Response(Buffer.from([9,8]),{headers:{'content-type':'application/octet-stream'}});
  };
  const result=await fetchRobloxOpenCloudAsset('987',{key:'private-key',fetchImpl});
  assert.deepEqual(result.bytes,Buffer.from([9,8]));
  assert.deepEqual(seen[1].headers,{});
});
test('official contentdelivery.roblox.com signed location loads without sending credentials',async()=>{
  const requests=[];
  const fetchImpl=async(url,options)=>{
    requests.push({url,headers:options.headers});
    if(requests.length===1)return Response.json({location:'https://contentdelivery.roblox.com/v1/asset?token=example'});
    return new Response(Buffer.from([5,6,7]),{headers:{'content-type':'application/octet-stream'}});
  };
  const result=await fetchRobloxOpenCloudAsset('1029523',{key:'secret',fetchImpl});
  assert.deepEqual(result.bytes,Buffer.from([5,6,7]));
  assert.equal(requests.length,2);
  assert.deepEqual(requests[1].headers,{});
});
test('untrusted redirects and unauthorized requests fail closed',async()=>{
  const redirect=await fetchRobloxOpenCloudAsset('123',{key:'key',
    fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://evil.example/asset'}})});
  assert.equal(redirect.reason,'untrusted_redirect');
  const unauth=await fetchRobloxOpenCloudAsset('123',{key:'key',
    fetchImpl:async()=>new Response('no',{status:403})});
  assert.equal(unauth.reason,'upstream_auth_required');
});
test('new RBXL importer registers an uncatalogued map and emits coverage',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-import-any-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'server/native/maps'),{recursive:true});
  fs.mkdirSync(path.join(root,'site'),{recursive:true});
  fs.writeFileSync(path.join(root,'server/native/places.json'),JSON.stringify({format:1,places:{}}));
  const input=path.join(root,'custom.rbxl');
  fs.writeFileSync(input,'<roblox><Item><url>rbxassetid://456789</url></Item></roblox>');
  const run=spawnSync(process.execPath,[path.join(repo,'tools/import-any-native.mjs'),
    '--root',root,'--file',input,'--id','modern-custom','--offline'],{encoding:'utf8',timeout:20000});
  assert.equal(run.status,0,run.stderr);
  const registry=JSON.parse(fs.readFileSync(path.join(root,'server/native/places.json')));
  assert.equal(registry.places['modern-custom'].id,1);
  assert.ok(fs.existsSync(path.join(root,'server/native/asset-reports/modern-custom.json')));
  assert.ok(fs.existsSync(path.join(root,'server/native/asset-index.modern-custom.json')));
  assert.ok(!fs.existsSync(path.join(root,'server/native/asset-index.json')));
  const report=JSON.parse(fs.readFileSync(path.join(root,'server/native/asset-reports/modern-custom.json')));
  assert.equal(report.assets[0].id,'456789');
});
