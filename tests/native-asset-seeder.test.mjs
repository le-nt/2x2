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

test('full archive orchestrator creates a prioritized missing-ID recovery report without network by default',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-native-fullseed-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const maps=path.join(dir,'server/native/maps');
  fs.mkdirSync(maps,{recursive:true});
  fs.writeFileSync(path.join(maps,'map.rbxl'),'<roblox><Item>rbxassetid://999654321</Item></roblox>');
  fs.writeFileSync(path.join(dir,'server/native/places.json'),JSON.stringify({places:{fixture:{file:'map.rbxl',name:'Fixture',id:27}}}));
  const run=spawnSync(process.execPath,[path.join(projectRoot,'tools/seed-full-archive.mjs'),'--root',dir],{encoding:'utf8',timeout:20000});
  assert.equal(run.status,0,run.stderr);
  const missing=JSON.parse(fs.readFileSync(path.join(dir,'server/native/asset-recovery/missing-assets.json'),'utf8'));
  assert.equal(missing.assets.length,1);
  assert.deepEqual(missing.assets[0].examplePlaces,['fixture']);
  assert.equal(missing.assets[0].id,'999654321');
  assert.ok(!fs.existsSync(path.join(dir,'server/native/asset-seed/999654321')));
});

test('new imports automatically inventory nested model resources, decoded XML values, and depth limits',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-vfs-ingestion-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const maps=path.join(dir,'server/native/maps'),lib=path.join(dir,'server/native/asset-library');
  const content=path.join(dir,'clients/2009E/content/textures');
  for(const folder of [maps,lib,content])fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(maps,'map.rbxl'),'<roblox><Item><string>rbxassetid://&#49;2345</string></Item></roblox>');
  fs.writeFileSync(path.join(lib,'12345.rbxmx'),'<roblox><Item><url>rbxasset://Textures/SpawnLocation.png</url><url>rbxassetid://98765</url></Item></roblox>');
  fs.writeFileSync(path.join(lib,'98765.png'),'dependency bytes');
  fs.writeFileSync(path.join(content,'SpawnLocation.png'),'original historical bytes');
  fs.writeFileSync(path.join(dir,'server/native/places.json'),JSON.stringify({places:{fixture:{file:'map.rbxl',id:1}}}));
  const args=[path.join(projectRoot,'tools/seed-native-assets.mjs'),'--root',dir,'--place','fixture'];
  const run=spawnSync(process.execPath,args,{encoding:'utf8',timeout:20000});
  assert.equal(run.status,0,run.stderr);
  const file=path.join(dir,'server/native/asset-reports/fixture.json');
  let report=JSON.parse(fs.readFileSync(file));
  assert.equal(report.statuses.local,2);
  assert.equal(report.resourceReferences[0].status,'resolved');
  assert.equal(report.resourceReferences[0].parentAsset,'12345');
  assert.equal(report.gameplayStatus,'not_tested');assert.equal(report.complete,true);
  const config=JSON.parse(fs.readFileSync(path.join(dir,'server/native/asset-vfs-config.json')));
  assert.ok(config.roots.every(root=>!path.isAbsolute(root.path)),'generated configuration works on Windows and Linux mounts');
  assert.equal(spawnSync(process.execPath,[...args,'--max-depth','0'],{encoding:'utf8',timeout:20000}).status,0);
  report=JSON.parse(fs.readFileSync(file));assert.equal(report.complete,false);assert.equal(report.truncated,true);
  fs.writeFileSync(path.join(maps,'map.rbxl'),'<roblox><Item>');
  assert.equal(spawnSync(process.execPath,args,{encoding:'utf8',timeout:20000}).status,0);
  assert.equal(JSON.parse(fs.readFileSync(file)).complete,false,'invalid XML cannot be called completely scanned');
});

test('new place reports include original character-bootstrap animation dependencies',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-runtime-deps-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const maps=path.join(dir,'server/native/maps'),lib=path.join(dir,'server/native/asset-library');
  const fonts=path.join(dir,'services/engine/.assets/content/fonts');
  for(const folder of [maps,lib,fonts])fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(maps,'map.rbxl'),'<roblox version="4"><Item class="Workspace"><Properties><string name="Name">Workspace</string></Properties></Item></roblox>');
  fs.writeFileSync(path.join(fonts,'humanoidAnimateLocalKeyframe2.rbxm'),'<roblox version="4"><Item class="LocalScript"><Properties><string name="Name">Animate</string><ProtectedString name="Source"><![CDATA[error("static analysis must never execute this"); local hold="rbxassetid://87654321"]]></ProtectedString></Properties></Item></roblox>');
  fs.writeFileSync(path.join(lib,'87654321.rbxmx'),'<roblox version="4"></roblox>');
  fs.writeFileSync(path.join(dir,'server/native/places.json'),JSON.stringify({places:{fixture:{file:'map.rbxl',id:1}}}));
  const run=spawnSync(process.execPath,[path.join(projectRoot,'tools/seed-native-assets.mjs'),'--root',dir],{encoding:'utf8',timeout:20000});
  assert.equal(run.status,0,run.stderr);
  const report=JSON.parse(fs.readFileSync(path.join(dir,'server/native/asset-reports/fixture.json')));
  assert.equal(report.discoveredAssets,1);assert.equal(report.statuses.local,1);
  assert.deepEqual(report.nativeRuntimeDependencies.models[0].assetIds,['87654321']);
  assert.equal(report.nativeRuntimeDependencies.models[0].resource,'fonts/humanoidAnimateLocalKeyframe2.rbxm');
  assert.ok(report.nativeRuntimeDependencies.unavailableModels.includes('fonts/humanoidAnimateR15.rbxm'));
  assert.equal(report.resourceReferences.find(r=>r.reference.includes('humanoidAnimateLocalKeyframe2')).status,'resolved');
});
