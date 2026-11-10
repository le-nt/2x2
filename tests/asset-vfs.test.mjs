import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {canonicalResource,createAssetVfs,createAssetVfsProvider} from '../server/lib/asset-vfs.mjs';
import {inventoryArchives} from '../tools/inventory-asset-vfs.mjs';

function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-vfs-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const roots=[{id:'2009',namespace:'content',clientVersion:'2009E',path:path.join(dir,'old')},
    {id:'2016',namespace:'content',clientVersion:'2016',path:path.join(dir,'new')},
    {id:'shared',namespace:'shareddata',path:path.join(dir,'shared')}];
  function write(index,rel,bytes) {const file=path.join(roots[index].path,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);return file;}
  return {dir,roots,write};
}
test('inventory resolves exact relative paths without copying and preserves provenance',async t=>{
  const {roots,write}=fixture(t);
  const file=write(0,'Textures/SpawnLocation.png','original bytes');
  write(2,'RiseOfTheKillbots/fonts/Shotgun.mesh','mesh');
  const manifest=await inventoryArchives(roots);
  const vfs=createAssetVfs({manifest,roots});
  const result=vfs.resolve('rbxasset://textures/spawnlocation.PNG');
  assert.equal(result.status,'resolved');assert.equal(result.file,fs.realpathSync.native(file));
  assert.equal(manifest.files[0].compatibility,'not_tested');
  assert.equal(vfs.resolve('rbxasset://../../../shareddata/RiseOfTheKillbots/fonts/Shotgun.mesh').status,'resolved');
  assert.equal(vfs.resolve('rbxasset://SpawnLocation.png').status,'unresolved');
  assert.equal(vfs.resolve('rbxasset://Textures//SpawnLocation.png').status,'resolved');
  assert.equal(vfs.resolve('rbxasset:////Textures/SpawnLocation.png').status,'invalid_reference');
  assert.equal(vfs.resolve('rbxasset://Textures//../SpawnLocation.png').status,'invalid_reference');
});
test('conflicting historical bytes require version or known hash; duplicates are safe',async t=>{
  const {roots,write}=fixture(t);
  write(0,'fonts/teapot.mesh','old');write(1,'fonts/teapot.mesh','new');
  write(0,'sounds/Rocket whoosh 01.wav','same');write(1,'sounds/Rocket whoosh 01.wav','same');
  const manifest=await inventoryArchives(roots), vfs=createAssetVfs({manifest,roots});
  assert.equal(manifest.collisions.filter(c=>c.kind==='conflict').length,1);
  assert.equal(manifest.collisions.filter(c=>c.kind==='duplicate').length,1);
  assert.equal(vfs.resolve('fonts/teapot.mesh').status,'conflict');
  assert.equal(vfs.resolve('fonts/teapot.mesh',{version:'2009E'}).status,'resolved');
  assert.equal(vfs.resolve('sounds/Rocket whoosh 01.wav').status,'resolved');
  assert.equal(vfs.resolve('fonts/teapot.mesh',{version:'unknown'}).status,'unresolved');
});
test('rejects traversal and manifest-supplied absolute paths; verifies bytes after inventory',async t=>{
  const {roots,write,dir}=fixture(t);
  const file=write(0,'textures/icon.png','safe');
  const manifest=await inventoryArchives(roots);
  fs.writeFileSync(file,'evil');
  const vfs=createAssetVfs({manifest,roots});
  assert.equal(vfs.resolve('textures/icon.png').status,'integrity_mismatch');
  for (const value of ['rbxasset://../textures/icon.png','rbxasset://../../../shareddata/../secret.png',
    '/etc/passwd','C:/secret.png','shareddata/%2e%2e/secret.png','fonts\\secret.mesh','shareddata/a.png?x=1','shareddata/a/./b.png'])
    assert.equal(canonicalResource(value),null,value);
  manifest.files[0].originalLocation=path.join(dir,'outside.png');
  manifest.files[0].relativePath='../outside.png';
  assert.equal(createAssetVfs({manifest,roots}).resolve('textures/icon.png').status,'unresolved');
});
test('scanner reports missing roots and bounded truncation instead of claiming completeness',async t=>{
  const {roots,write}=fixture(t);write(0,'a.png','a');write(0,'b.png','b');
  const manifest=await inventoryArchives(roots,{maxFiles:1});
  assert.equal(manifest.truncated,true);assert.equal(manifest.complete,false);
  const missing=await inventoryArchives([roots[2]]);
  assert.equal(missing.complete,false);assert.equal(missing.diagnostics[0].reason,'root_unavailable');
});
test('archive symlink escapes are rejected even after manifest generation',async t=>{
  const {roots,write,dir}=fixture(t);const file=write(0,'textures/icon.png','safe');
  const manifest=await inventoryArchives(roots);
  const outside=path.join(dir,'outside.png');fs.writeFileSync(outside,'safe');fs.unlinkSync(file);
  try {fs.symlinkSync(outside,file);} catch(error) {if(error.code==='EPERM')return t.skip('Host disallows symlink creation');throw error;}
  assert.equal(createAssetVfs({manifest,roots}).resolve('textures/icon.png').status,'unavailable');
});

test('inventory-only numeric stores record provenance without exposing arbitrary files',async t=>{
  const {roots,write}=fixture(t);
  write(0,'12345.png','genuine asset bytes');write(0,'metadata.json','server metadata');write(0,'empty.fnt','');
  const inventoryRoots=[{...roots[0],namespace:'inventory',assetIdLayout:'numeric'}];
  const manifest=await inventoryArchives(inventoryRoots);
  assert.equal(manifest.files.length,3);
  assert.equal(manifest.files.find(e=>e.relativePath==='12345.png').assetId,'12345');
  const vfs=createAssetVfs({manifest,roots:inventoryRoots});
  assert.equal(vfs.resolve('12345.png').status,'unresolved');
  assert.equal(vfs.resolve('metadata.json').status,'invalid_reference');
});

test('configured but broken manifests fail closed rather than falling back to unverified paths',t=>{
  const {dir}=fixture(t);
  fs.mkdirSync(path.join(dir,'server/native'),{recursive:true});
  fs.writeFileSync(path.join(dir,'server/native/asset-vfs-config.json'),JSON.stringify({roots:[],manifest:'missing.json'}));
  assert.equal(createAssetVfsProvider(dir).resolve('textures/icon.png').status,'vfs_configuration_error');
});

test('approved relocations pin original bytes and never override exact paths or follow chains',async t=>{
  const {roots,write}=fixture(t);
  write(0,'avatar/scripts/health.rbxmx','genuine script');
  let manifest=await inventoryArchives(roots);
  const hash=manifest.files[0].sha256;
  const mappings=[{from:'fonts/health.rbxm',to:'avatar/scripts/health.rbxmx',sha256:hash,reason:'Verified archive layout migration'}];
  let vfs=createAssetVfs({manifest,roots,mappings});
  const result=vfs.resolve('fonts/health.rbxm');
  assert.equal(result.status,'resolved');assert.equal(result.sha256,hash);
  assert.equal(result.mapping.target.relativePath,'avatar/scripts/health.rbxmx');
  assert.equal(vfs.resolve('fonts/health.rbxm',{expectedSha256:'0'.repeat(64)}).status,'mapping_hash_mismatch');
  assert.equal(vfs.resolve('fonts/health.rbxm',{version:'unknown'}).status,'unresolved');
  write(1,'fonts/health.rbxm','exact path wins');
  manifest=await inventoryArchives(roots);vfs=createAssetVfs({manifest,roots,mappings});
  assert.equal(vfs.resolve('fonts/health.rbxm').mapping,undefined);
  assert.equal(fs.readFileSync(vfs.resolve('fonts/health.rbxm').file,'utf8'),'exact path wins');
  for(const invalid of [[...mappings,...mappings],[{...mappings[0],to:'../secret.lua'}],[{...mappings[0],sha256:'guess'}]])
    assert.throws(()=>createAssetVfs({manifest,roots,mappings:invalid}),/Invalid Asset VFS mapping/);
  vfs=createAssetVfs({manifest,roots,mappings:[{from:'fonts/start.rbxm',to:'fonts/missing.rbxm',sha256:hash,reason:'No chain'},
    {from:'fonts/missing.rbxm',to:'avatar/scripts/health.rbxmx',sha256:hash,reason:'No chain'}]});
  assert.equal(vfs.resolve('fonts/start.rbxm').status,'unresolved');
});

test('versioned virtual mounts resolve original archive files without staging copies',async t=>{
  const {roots,write}=fixture(t);
  const first=write(0,'textures/icon.png','old icon');
  const second=write(1,'textures/icon.png','new icon');
  roots[0].virtualPrefix='archive/2009';roots[1].virtualPrefix='archive/2016';
  const manifest=await inventoryArchives(roots);
  assert.equal(manifest.collisions.length,0);
  assert.equal(manifest.files[0].relativePath,'textures/icon.png');
  // Manifest mount hints have no authority over the configured mount.
  manifest.files[0].virtualPrefix='malicious';
  const hash=manifest.files.find(e=>e.rootId==='2009').sha256;
  const vfs=createAssetVfs({manifest,roots,mappings:[{from:'textures/icon.png',to:'archive/2009/textures/icon.png',sha256:hash,reason:'Original archive version'}]});
  assert.equal(vfs.resolve('archive/2009/textures/icon.png').file,fs.realpathSync.native(first));
  assert.equal(vfs.resolve('archive/2016/textures/icon.png').file,fs.realpathSync.native(second));
  assert.equal(vfs.resolve('textures/icon.png').sha256,hash);
  assert.equal(vfs.resolve('malicious/textures/icon.png').status,'unresolved');
  fs.writeFileSync(first,'bad icon');
  assert.equal(vfs.resolve('textures/icon.png').status,'integrity_mismatch');
  roots[1].virtualPrefix='ARCHIVE/2009';
  const conflict=await inventoryArchives(roots);
  assert.equal(conflict.collisions[0].key,'content/archive/2009/textures/icon.png');
  assert.equal(createAssetVfs({manifest:conflict,roots}).resolve('archive/2009/textures/icon.png').status,'conflict');
});

test('shareddata virtual mounts retain namespace and reject unsafe prefixes',async t=>{
  const {roots,write}=fixture(t);write(2,'fonts/weapon.mesh','original mesh');
  roots[2].virtualPrefix='novetus-1.3';
  const manifest=await inventoryArchives(roots);
  assert.equal(createAssetVfs({manifest,roots}).resolve('shareddata/novetus-1.3/fonts/weapon.mesh').status,'resolved');
  for(const prefix of ['../escape','/absolute','a//b','a/','a\\b','C:/drive','x%2fescape','a?b','a/..','a.','a\u0000b',42]) {
    const invalid=[{...roots[2],virtualPrefix:prefix}];
    assert.throws(()=>createAssetVfs({manifest,roots:invalid}),/virtual prefix/);
    await assert.rejects(inventoryArchives(invalid),/virtual prefix/);
  }
});
