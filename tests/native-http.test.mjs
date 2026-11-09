import {gunzipSync,gzipSync}from'node:zlib';import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import {spawn}from'node:child_process';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s.address().port)));
const close=s=>new Promise(r=>s.close(r));
import {inventoryArchives} from '../tools/inventory-asset-vfs.mjs';
test('native protocol shares 2x2 identity, requires the key, and gates WebSocket upgrades',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-native-'));
 fs.cpSync(path.join(root,'server'),path.join(tmp,'server'),{recursive:true,filter:f=>{
  const parts=path.relative(path.join(root,'server'),f).split(path.sep);
  return !parts.includes('native')&&!parts.includes('data')&&!f.endsWith('config.json');
 }});
 fs.mkdirSync(path.join(tmp,'site/data'),{recursive:true});fs.mkdirSync(path.join(tmp,'site/native-client'),{recursive:true});fs.mkdirSync(path.join(tmp,'server/native/maps'),{recursive:true});
 fs.copyFileSync(path.join(root,'site/data/maps.json'),path.join(tmp,'site/data/maps.json'));
 const classic=JSON.parse(fs.readFileSync(path.join(tmp,'site/data/maps.json'))).maps[0].id;
 fs.writeFileSync(path.join(tmp,'site/index.html'),'<title>2x2</title>');fs.writeFileSync(path.join(tmp,'server/native/maps/test.rbxl'),'<roblox version="4"></roblox>');
 const binary=Buffer.concat([Buffer.from('<roblox!\x89\xff\r\n\x1a\n','latin1'),Buffer.from([0,255,254,128,0,1])]);
 fs.writeFileSync(path.join(tmp,'server/native/maps/binary.rbxl'),binary);
 fs.mkdirSync(path.join(tmp,'server/native/asset-library'),{recursive:true});
 fs.mkdirSync(path.join(tmp,'server/native/asset-recovery/scripts'),{recursive:true});
 fs.writeFileSync(path.join(tmp,'server/native/asset-library/34854608.mesh'),'version 1.00\n');
 fs.copyFileSync(path.join(root,'server/native/asset-library/34854607.png'),path.join(tmp,'server/native/asset-library/34854607.png'));
 fs.writeFileSync(path.join(tmp,'server/native/asset-recovery/scripts/1014476.lua'),'print("linked Lua delivered")\n');
 fs.writeFileSync(path.join(tmp,'server/native/places.json'),JSON.stringify({format:1,places:{[classic]:{id:1,file:'test.rbxl'},'binary-map':{id:2,file:'binary.rbxl'}}}));
 const archive=path.join(tmp,'archive');fs.mkdirSync(path.join(archive,'sounds'),{recursive:true});
 fs.writeFileSync(path.join(archive,'sounds/Rocket whoosh 01.wav'),'original wav bytes');
 const sharedOne=path.join(tmp,'shared-one'),sharedTwo=path.join(tmp,'shared-two');
 for(const dir of [sharedOne,sharedTwo])fs.mkdirSync(path.join(dir,'textures'),{recursive:true});
 fs.mkdirSync(path.join(sharedOne,'recovered'));
 const recoveredPng=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
 fs.writeFileSync(path.join(sharedOne,'recovered/Cake.png'),recoveredPng);
 for(const name of ['conflict.png','local.png']){
  fs.writeFileSync(path.join(sharedOne,'textures',name),'archive one');
  fs.writeFileSync(path.join(sharedTwo,'textures',name),'archive two');
 }
 fs.mkdirSync(path.join(tmp,'site/native-legacy-assets/textures'),{recursive:true});
 fs.writeFileSync(path.join(tmp,'site/native-legacy-assets/textures/local.png'),'existing local bytes');
 const archiveRoots=[{id:'test-archive',namespace:'content',path:archive},{id:'shared-one',namespace:'shareddata',path:sharedOne},{id:'shared-two',namespace:'shareddata',path:sharedTwo}];
 fs.writeFileSync(path.join(tmp,'vfs-manifest.json'),JSON.stringify(await inventoryArchives(archiveRoots)));
 fs.writeFileSync(path.join(tmp,'vfs-config.json'),JSON.stringify({roots:archiveRoots,manifest:'vfs-manifest.json',mappings:[{from:'shareddata/textures/cake.png',to:'shareddata/recovered/Cake.png',sha256:createHash('sha256').update(recoveredPng).digest('hex'),reason:'Original archive texture relocation'}]}));
 const realPlaces=JSON.parse(fs.readFileSync(path.join(root,'server/native/places.json'))).places;
 const cross=realPlaces['2008m-crossroads'];
 if(cross){fs.copyFileSync(path.join(root,'server/native/maps',cross.file),path.join(tmp,'server/native/maps','crossroads.rbxl'));const fixture=JSON.parse(fs.readFileSync(path.join(tmp,'server/native/places.json')));fixture.places['2008m-crossroads']={id:294,file:'crossroads.rbxl'};fs.writeFileSync(path.join(tmp,'server/native/places.json'),JSON.stringify(fixture));}
 const files={};for(const name of ['UniversalClient.js','UniversalClient.wasm','UniversalClient.data']){fs.writeFileSync(path.join(tmp,'site/native-client',name),'protocol test fixture');files[name]={path:name,sha256:'a'.repeat(64)};}
 fs.writeFileSync(path.join(tmp,'site/native-client/manifest.json'),JSON.stringify({format:1,entry:'UniversalClient.js',files}));
 const key='worker-'+ 'a'.repeat(64),sign='b'.repeat(64);let appPort,starts=0,upgrades=0,child,logs='';const transports=new Set();
 const worker=http.createServer(async(req,res)=>{
  if(req.headers.accesskey!==key){res.writeHead(403).end();return;}
  if(req.url==='/gameserver/new'){
   starts++;for await(const _ of req){}
   const heartbeat=await fetch(`http://127.0.0.1:${appPort}/native/internal/gameserver/heartbeat`,{method:'POST',headers:{AccessKey:key,'Content-Type':'application/json','Content-Encoding':'gzip'},body:gzipSync(JSON.stringify({jobId:'job-test',userIds:[]}))});
   assert.equal(heartbeat.status,200);
   res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({success:true,job_id:'job-test'}));
  }else{for await(const _ of req){}res.writeHead(200,{'Content-Type':'application/json'}).end('{"success":true}');}
 });
 worker.on('upgrade',(req,socket,head)=>{
  assert.equal(req.headers.accesskey,key);assert.equal(req.url,'/ws/job-test');upgrades++;
  const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  transports.add(socket);socket.on('data',data=>socket.write(data));socket.on('close',()=>transports.delete(socket));socket.on('error',()=>{});
 });
 try{
  const workerPort=await listen(worker);const probe=http.createServer();appPort=await listen(probe);await close(probe);
  const cfg={accessToken:'the-entry-key',secret:'s'.repeat(64),native:{accessKey:key,signingKey:sign,arbiterOrigin:`http://127.0.0.1:${workerPort}`,publicOrigin:`http://127.0.0.1:${appPort}`}};
  fs.writeFileSync(path.join(tmp,'server/config.json'),JSON.stringify(cfg));
  child=spawn(process.execPath,[path.join(tmp,'server/server.mjs'),String(appPort)],{env:{...process.env,ROBLOX_ASSET_FETCH:'0',RBX_ASSET_VFS_CONFIG:path.join(tmp,'vfs-config.json')}});child.stdout.on('data',c=>logs+=c);child.stderr.on('data',c=>logs+=c);
  const base=`http://127.0.0.1:${appPort}`;
  let ready=false;const startupDeadline=Date.now()+10000;
  while(Date.now()<startupDeadline){
   assert.equal(child.exitCode,null,'Server exited during startup: '+logs);
   try{const response=await fetch(base,{signal:AbortSignal.timeout(500)});await response.body?.cancel();ready=true;break;}
   catch{await new Promise(r=>setTimeout(r,30));}
  }
  assert.ok(ready,'Server did not become ready within 10 seconds: '+logs);
  let cookies='';
  async function request(route,options={},cookie=cookies){return fetch(base+route,{redirect:'manual',...options,headers:{Cookie:cookie,...options.headers}});}
  assert.equal((await request('/native-client/manifest.json')).status,401);
  assert.equal((await request('/api/native/status')).status,401);
  assert.equal((await request('/api/ads')).status,401,'ad discovery keeps the entrance gate');
  assert.equal((await request('/native/internal/gameserver/heartbeat',{method:'POST',headers:{AccessKey:'wrong'},body:'{}'})).status,401);
  assert.equal((await request('/api/me',{headers:{AccessKey:key}})).status,401,'machine key cannot bypass the account API');
  const entry=await request('/?key='+cfg.accessToken);cookies=entry.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');assert.equal(entry.status,303);
  assert.equal((await request('/api/native/status')).status,401,'key is not a login');
  assert.deepEqual((await(await request('/api/ads')).json()).images,[],'a missing ad folder is harmless');
  assert.equal((await(await request('/api/native/version')).json()).version,'2x2-native-map-pack-v1');
  const register=await request('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'NativeTester',password:'A_test_password!2'})});assert.equal(register.status,200);
  cookies+='; '+register.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  const me=await(await request('/api/me')).json();assert.equal(me.user.username,'NativeTester');
  const chatInfo='/native/api/game/players/'+me.user.id;
  assert.deepEqual(await(await request(chatInfo,{headers:{AccessKey:key}},'')).json(),{ChatFilter:'blacklist'},'RCC can fetch chat settings without entrance cookies');
  assert.equal((await request(chatInfo,{headers:{AccessKey:'wrong'}},'')).status,401);
  const chat=await request('/native/api/moderation/filtertext',{method:'POST',headers:{AccessKey:key,'Content-Type':'application/x-www-form-urlencoded'},body:'userId='+me.user.id+'&text=hello+multiplayer'},'');
  assert.equal(chat.status,200);assert.deepEqual(await chat.json(),{data:{white:'hello multiplayer',black:'hello multiplayer'}});
  assert.equal((await request('/native/api/moderation/filtertext',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'text=spoofed'})).status,403,'browser sessions cannot impersonate the worker filter');
  const launch=await(await request('/api/native/launch?id='+classic)).json();assert.equal(launch.placeId,1);assert.ok(launch.joinScriptUrl.startsWith(base+'/native/'));
  assert.equal((await request('/api/native/launch?id=unknown')).status,503);
  if(cross){
   assert.equal(cross.file,'2008m-crossroads.rbxl','the repaired Crossroads map must be registered');
   const crossroadsLaunch=await request('/api/native/launch?id=2008m-crossroads');assert.equal(crossroadsLaunch.status,200);
   assert.equal((await crossroadsLaunch.json()).placeId,294);
   const delivered=await request('/native/asset?id=294',{headers:{AccessKey:key}},'');assert.equal(delivered.status,200);
   const original=fs.readFileSync(path.join(root,'server/native/maps',cross.file));
   const {rewriteLegacyAssetUrls}=await import('../server/lib/asset-resolver.mjs');
   const expected=Buffer.from(rewriteLegacyAssetUrls(original.toString('utf8'),base+'/native'));
   assert.equal(createHash('sha256').update(Buffer.from(await delivered.arrayBuffer())).digest('hex'),createHash('sha256').update(expected).digest('hex'),'Crossroads delivery preserves the map with expected URL routing');
  }
  const poll='/native/game/placelauncher?placeId=1';let joining;
  for(let i=0;i<50;i++){const r=await request(poll,{method:'POST'});const data=await r.json();if(data.status===2){joining=data;break;}await new Promise(r=>setTimeout(r,25));}
  assert.ok(joining,logs);assert.equal(starts,1);
  const datastore='/native/persistence/getV2?placeId=1&type=standard&scope=global';
  const dsHeaders={AccessKey:key,'Roblox-Game-Id':'job-test','Roblox-Place-Id':'1','Content-Type':'application/x-www-form-urlencoded'};
  const dsBody=new URLSearchParams({'qkeys[0].scope':'global','qkeys[0].key':'fixture','qkeys[0].target':'score'}).toString();
  const dsMissing=await request(datastore,{method:'POST',headers:dsHeaders,body:dsBody},'');
  assert.equal(dsMissing.status,200);assert.deepEqual(await dsMissing.json(),{data:[]});
  assert.equal((await request(datastore,{method:'POST',body:dsBody})).status,403,'website login alone cannot read game persistence');
  assert.equal((await request(datastore,{method:'POST',headers:{...dsHeaders,'Roblox-Game-Id':'unknown-job'},body:dsBody},'')).status,403);
  assert.equal((await request(datastore.replace('placeId=1','placeId=2'),{method:'POST',headers:dsHeaders,body:dsBody},'')).status,403,'worker headers must match the requested place');
  const dsSet=await request('/native/persistence/set?placeId=1&type=standard&scope=global&key=fixture&target=score&valueLength=1',{method:'POST',headers:dsHeaders,body:'value=7'},'');
  assert.equal(dsSet.status,200);assert.deepEqual(await dsSet.json(),{data:'7'});
  const dsSaved=await request(datastore,{method:'POST',headers:dsHeaders,body:dsBody},'');
  assert.equal((await dsSaved.json()).data[0].Value,'7');
  const info=await(await request(new URL(joining.joinScriptUrl).pathname+new URL(joining.joinScriptUrl).search)).json();assert.equal(info.UserName,me.user.username);assert.equal(info.UserId,me.user.id);assert.equal(info.PlaceId,1);assert.ok(!JSON.stringify(info).includes(key));assert.equal(info.ClientTicket.split(';').length,3);
  const app=await request('/native/appearance/'+me.user.id);assert.equal(app.status,200);assert.ok((await app.text()).includes('/native/bodycolors/'+me.user.id));
  const binaryResponse=await request('/native/asset?id=2',{headers:{AccessKey:key}},'');assert.deepEqual(Buffer.from(await binaryResponse.arrayBuffer()),binary,'binary map bytes must not be decoded as UTF-8');
  const serviceMap=await request('/native/asset?id=1',{headers:{AccessKey:key}},'');assert.equal(serviceMap.status,200);assert.ok((await serviceMap.text()).startsWith('<roblox'));
  const archived=await request('/native/archive-content?path='+encodeURIComponent('sounds/rocket whoosh 01.wav'),{headers:{AccessKey:key}},'');
  assert.equal(archived.status,200);assert.equal(await archived.text(),'original wav bytes');
  assert.equal((await request('/native/archive-content?path='+encodeURIComponent('../secret.wav'),{headers:{AccessKey:key}},'')).status,404);
  assert.equal((await request('/native/archive-content?path=sounds/missing.wav',{headers:{AccessKey:'wrong'}},'')).status,401);
  const recoveredTexture=await request('/native/legacy-texture?name=cake.png',{headers:{AccessKey:key}},'');
  assert.equal(recoveredTexture.status,200);assert.equal(recoveredTexture.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await recoveredTexture.arrayBuffer()),recoveredPng);
  assert.equal((await request('/native/legacy-texture?name=conflict.png',{headers:{AccessKey:key}},'')).status,409);
  assert.equal(await(await request('/native/legacy-texture?name=local.png',{headers:{AccessKey:key}},'')).text(),'existing local bytes');
  assert.equal((await request('/native/legacy-texture?name=cake.png',{headers:{AccessKey:'wrong'}},'')).status,401);
  fs.writeFileSync(path.join(sharedOne,'recovered/Cake.png'),'changed archive bytes');
  const damagedTexture=await request('/native/legacy-texture?name=cake.png',{headers:{AccessKey:key}},'');
  assert.equal(damagedTexture.status,404);assert.equal((await damagedTexture.json()).reason,'integrity_mismatch');
  const mesh=await request('/native/asset?id=34854608',{headers:{AccessKey:key}},'');
  assert.equal(mesh.status,200);assert.equal(await mesh.text(),'version 1.00\n');
  const overlay=await request('/api/asset?id=34854607',{headers:{AccessKey:key}},'');
  assert.equal(overlay.status,200);assert.equal(overlay.headers.get('Content-Type'),'image/png');
  assert.deepEqual(Buffer.from(await overlay.arrayBuffer()),fs.readFileSync(path.join(root,'server/native/asset-library/34854607.png')));
  const lua=await request('/native/asset?id=1014476',{headers:{AccessKey:key}},'');
  assert.equal(lua.status,200);assert.match(await lua.text(),/linked Lua delivered/);
  assert.equal((await request('/native/asset?id=34854608',{headers:{AccessKey:'wrong'}},'')).status,401);
  assert.equal((await request('/native/asset?id=999999999',{headers:{AccessKey:key}},'')).status,404);
  // New imports become visible to an already running server; an invalid
  // replacement registry must not destroy its last valid catalog.
  const registryFile=path.join(tmp,'server/native/places.json');
  const updated=JSON.parse(fs.readFileSync(registryFile));
  fs.writeFileSync(path.join(tmp,'server/native/maps/new.rbxl'),'<roblox version="4"></roblox>');
  updated.places['new-import']={id:3,file:'new.rbxl'};
  fs.writeFileSync(registryFile+'.tmp',JSON.stringify(updated));fs.renameSync(registryFile+'.tmp',registryFile);
  await new Promise(resolve=>setTimeout(resolve,1100));
  const imported=await request('/api/native/launch?id=new-import');const importedBody=await imported.text();assert.equal(imported.status,200,importedBody);assert.equal(JSON.parse(importedBody).placeId,3);
  const broken={...updated,places:{...updated.places,duplicate:{id:3,file:'new.rbxl'}}};
  fs.writeFileSync(registryFile+'.tmp',JSON.stringify(broken));fs.renameSync(registryFile+'.tmp',registryFile);
  await new Promise(resolve=>setTimeout(resolve,1100));
  assert.equal((await request('/api/native/launch?id=new-import')).status,200);
  const socketURL=new URL(info.WebSocketAddress);
  async function handshake(cookie,origin){return new Promise((resolve,reject)=>{
   const req=http.request(base+socketURL.pathname+socketURL.search,{headers:{Cookie:cookie,Origin:origin,Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':'dGhlIHNhbXBsZSBub25jZQ=='}});
   req.on('response',r=>{r.resume();resolve(r.statusCode);});req.on('upgrade',(_r,socket)=>{socket.on('error',()=>{});socket.destroy();resolve(101);});req.on('error',reject);req.end();
  });}
  assert.equal(await handshake('',base),403);assert.equal(await handshake(cookies,'https://other.invalid'),403);assert.equal(await handshake(cookies,base),101);assert.equal(upgrades,1);
  const locked=await request('/__lock',{method:'POST'});assert.equal(locked.status,303);assert.ok(locked.headers.getSetCookie().some(x=>x.startsWith('rbxgate=')&&x.includes('Max-Age=0')));
  assert.equal(await handshake(cookies,base),403,'locking revokes the account session and its connection tickets');
  const publicAfterLock=await(await request('/api/me')).json();assert.equal(publicAfterLock.user,null);
  const configAfter=JSON.parse(fs.readFileSync(path.join(tmp,'server/config.json')));assert.equal(configAfter.accessToken,'the-entry-key');
 }finally{
  for(const socket of transports)socket.destroy();worker.closeAllConnections();await close(worker);
  if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}
  fs.rmSync(tmp,{recursive:true,force:true});
 }
});
