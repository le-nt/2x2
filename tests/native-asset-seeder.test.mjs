import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {scanAssetReferences} from '../server/lib/asset-discovery.mjs';
import {createAssetResolver} from '../server/lib/asset-resolver.mjs';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('asset crawler detects old Roblox, Project Pizda, SBCR, and Script source references',()=>{
  const xml='<roblox><Item><string name="Script">local texture="rbxassetid://12345"</string>' +
    '<url>https://www.projectpizza.net/api/asset?id=998</url>' +
    '<url>http://www.roblox.com/asset/?id=654</url>' +
    '<url>rbxasset://../../../shareddata/SBCR/765</url>' +
    '<url>rbxasset://Textures/SpawnLocation.png</url></Item></roblox>';
  const result=scanAssetReferences(Buffer.from(xml));
  assert.equal(result.coverage,'xml_text');
  assert.deepEqual(result.ids,['654','765','998','12345']);
  assert.ok(!result.ids.includes('0'));
});

test('binary string scanning reports partial results instead of falsely claiming full decode',()=>{
  const binary=Buffer.concat([Buffer.from('<roblox!\x89\xff\r\n\x1a\n','latin1'),Buffer.from('rbxassetid://87263')]);
  const result=scanAssetReferences(binary);
  assert.equal(result.coverage,'binary_strings_partial');
  assert.deepEqual(result.ids,['87263']);
});

test('offline seeder recursively archives model dependencies and writes per-place reports',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-native-seed-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const maps=path.join(dir,'server/native/maps');
  const lib=path.join(dir,'server/native/asset-library');
  fs.mkdirSync(maps,{recursive:true});fs.mkdirSync(lib,{recursive:true});
  fs.mkdirSync(path.join(dir,'site'),{recursive:true});
  fs.writeFileSync(path.join(maps,'fixture.rbxl'),'<roblox><Item>rbxassetid://12345</Item></roblox>');
  fs.writeFileSync(path.join(lib,'12345.rbxmx'),'<roblox><Item>rbxassetid://98765</Item></roblox>');
  fs.writeFileSync(path.join(lib,'98765.png'),Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]));
  fs.writeFileSync(path.join(dir,'server/native/places.json'),JSON.stringify({places:{'fixture-map':{file:'fixture.rbxl',name:'Fixture map',id:17}}}));
  const result=spawnSync(process.execPath,[path.join(projectRoot,'tools/seed-native-assets.mjs'),'--root',dir,'--max-fetch','0'],{encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stderr);
  const index=JSON.parse(fs.readFileSync(path.join(dir,'server/native/asset-index.json'),'utf8'));
  const byId=Object.fromEntries(index.assets.map(a=>[a.id,a]));
  assert.deepEqual(Object.keys(byId).sort(),['12345','98765']);
  assert.deepEqual(byId['12345'].dependencies,['98765']);
  assert.ok(fs.existsSync(path.join(dir,'server/native/asset-seed/12345.rbxmx')));
  assert.ok(fs.existsSync(path.join(dir,'server/native/asset-seed/98765.png')));
  const game=JSON.parse(fs.readFileSync(path.join(dir,'server/native/asset-reports/fixture-map.json'),'utf8'));
  assert.equal(game.discoveredAssets,2);
  assert.equal(game.statuses.local,2);
  const resolver=createAssetResolver({serverDir:path.join(dir,'server'),siteDir:path.join(dir,'site')});
  assert.match(resolver.lookup('12345').file,/asset-seed/);
  // Re-running the seeder must preserve bytes and produce equivalent coverage.
  const repeat=spawnSync(process.execPath,[path.join(projectRoot,'tools/seed-native-assets.mjs'),'--root',dir],{encoding:'utf8',timeout:20000});
  assert.equal(repeat.status,0,repeat.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'server/native/asset-index.json'))).stats.assetReferences,2);
});
