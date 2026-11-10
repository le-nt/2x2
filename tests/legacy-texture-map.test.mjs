import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadLegacyTextureMap,legacyTextureAssetId} from '../server/lib/legacy-texture-map.mjs';
test('verified numeric mappings enable Open Cloud for otherwise missing bundled textures',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-legacy-textures-'));
 try{
  const file=path.join(dir,'mapping.json');
  assert.equal(loadLegacyTextureMap(file).size,0);
  fs.writeFileSync(file,JSON.stringify({'SpawnLocation.png':'12345'}));
  const mapping=loadLegacyTextureMap(file);
  assert.equal(legacyTextureAssetId('spawnlocation.PNG',mapping),'12345');
  assert.equal(legacyTextureAssetId('../SpawnLocation.png',mapping),null);
  assert.equal(legacyTextureAssetId('unknown.png',mapping),null);
  fs.writeFileSync(file,JSON.stringify({'SpawnLocation.png':'../../123'}));
  assert.throws(()=>loadLegacyTextureMap(file),/Invalid legacy texture/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
