import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createAssetResolver} from '../server/lib/asset-resolver.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-assets-'));
const a=path.join(tmp,'server/native/asset-library');
const b=path.join(tmp,'site/data/scenes/assets');
fs.mkdirSync(a,{recursive:true});fs.mkdirSync(b,{recursive:true});
fs.writeFileSync(path.join(a,'34854607.mesh'),Buffer.from([0,1,2]));
fs.writeFileSync(path.join(b,'assets_345.png'),Buffer.from([137,80,78,71]));
const resolver=createAssetResolver({serverDir:path.join(tmp,'server'),siteDir:path.join(tmp,'site')});
test('resolve local numeric asset IDs',()=>assert.equal(fs.readFileSync(resolver.lookup('34854607').file).length,3));
test('resolve previously exported scene assets',()=>assert.ok(resolver.lookup('345').file.endsWith('assets_345.png')));
test('reject paths and unsafe identifiers',()=>{for(const id of ['../123','0','-1','1/2','1%2f2','99999999999999999999'])assert.equal(resolver.lookup(id),null);});
test('missing IDs remain missing rather than fetching externally',()=>assert.equal(resolver.lookup('8888888'),null));
test('never follow symlinks outside the trusted directory',(t)=>{
  const outside=path.join(tmp,'secret');fs.writeFileSync(outside,'secret');
  try {try{fs.symlinkSync(outside,path.join(a,'999.mesh'));}catch(error){if(process.platform==='win32' && error.code==='EPERM'){t.skip('Windows symlink privilege unavailable');return;}throw error;}assert.equal(resolver.lookup('999'),null);} finally {try{fs.unlinkSync(path.join(a,'999.mesh'));}catch{}}
});


test('AyaEX-style XML rewrite changes only Roblox asset URLs', async()=>{
  const {rewriteLegacyAssetUrls}=await import('../server/lib/asset-resolver.mjs');
  const original='<roblox>http://www.roblox.com/asset/?id=123 https://roblox.com/asset?id=456 https://example.org/asset?id=789</roblox>';
  const rewritten=rewriteLegacyAssetUrls(original,'https://2x2.example');
  assert.match(rewritten,/https:\/\/2x2\.example\/api\/asset\?id=123/);
  assert.match(rewritten,/https:\/\/2x2\.example\/api\/asset\?id=456/);
  assert.match(rewritten,/https:\/\/example\.org\/asset\?id=789/);
  assert.equal(rewriteLegacyAssetUrls(original,'https://evil.example/extra'),original);
});
test('negative lookup cache is bounded and does not accept zero-padded IDs',()=>{
  assert.equal(resolver.lookup('000345'),null);
  for(let id=1000000;id<1002100;id++)assert.equal(resolver.lookup(String(id)),null);
  assert.equal(resolver.lookup('345')?.ext,'.png');
});
test('binary RBXM stays a binary file',()=>{
  const bytes=Buffer.from([0,255,1,2,3]);
  fs.writeFileSync(path.join(a,'678.rbxm'),bytes);
  assert.deepEqual(fs.readFileSync(resolver.lookup('678').file),bytes);
});


test('native legacy URL substitution uses native route',async()=>{
 const {rewriteLegacyAssetUrls}=await import('../server/lib/asset-resolver.mjs');
 const xml='<roblox><url>http://www.roblox.com/asset/?id=123</url></roblox>';
 assert.match(rewriteLegacyAssetUrls(xml,'https://example.test/native'),/https:\/\/example\.test\/native\/asset\?id=123/);
});
test('extensionless local Aya library resolves images and XML by signature',()=>{
 const aya=path.join(tmp,'aya-assets');
 fs.mkdirSync(aya,{recursive:true});
 const saved=process.env.AYA_ASSETS_DIR;
 process.env.AYA_ASSETS_DIR=aya;
 try {
  fs.writeFileSync(path.join(aya,'776'),Buffer.from([137,80,78,71,13,10,26,10,0]));
  fs.writeFileSync(path.join(aya,'777'),Buffer.from([255,216,255,0]));
  fs.writeFileSync(path.join(aya,'778'),'<roblox version="4"></roblox>');
  const local=createAssetResolver({serverDir:path.join(tmp,'server'),siteDir:path.join(tmp,'site')});
  assert.equal(local.lookup('776')?.ext,'.png');
  assert.equal(local.lookup('777')?.ext,'.jpg');
  assert.equal(local.lookup('778')?.ext,'.rbxmx');
 }finally{
  if(saved===undefined)delete process.env.AYA_ASSETS_DIR;
  else process.env.AYA_ASSETS_DIR=saved;
 }
});

test('legacy /asset aliases resolve locally and preserve HEAD responses', async t => {
  const {createServer}=await import('node:http');
  const server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(!resolver.handle(req,res,url))res.writeHead(404).end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base='http://127.0.0.1:'+server.address().port;
  for(const route of ['/api/asset?id=34854607','/asset?id=34854607','/asset/?id=34854607']){
    const get=await fetch(base+route);
    assert.equal(get.status,200,route);
    assert.deepEqual(Buffer.from(await get.arrayBuffer()),Buffer.from([0,1,2]));
    const head=await fetch(base+route,{method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(head.headers.get('content-length'),'3');
    assert.equal((await head.arrayBuffer()).byteLength,0);
  }
  assert.equal((await fetch(base+'/asset/malicious?id=34854607')).status,404);
  assert.equal((await fetch(base+'/asset/?id=../../secret')).status,400);
});
