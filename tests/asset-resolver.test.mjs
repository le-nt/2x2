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
test('never follow symlinks outside the trusted directory',()=>{
  const outside=path.join(tmp,'secret');fs.writeFileSync(outside,'secret');
  try {fs.symlinkSync(outside,path.join(a,'999.mesh'));assert.equal(resolver.lookup('999'),null);} finally {try{fs.unlinkSync(path.join(a,'999.mesh'));}catch{}}
});
