import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {Readable,PassThrough} from 'node:stream';
import http from 'node:http';
import {openDb} from '../server/lib/db.mjs';
import {createNativeImports} from '../server/lib/native-imports.mjs';

const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(t,environment={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-native-imports-'));
  const server=path.join(root,'server');fs.mkdirSync(path.join(server,'native'),{recursive:true});
  fs.mkdirSync(path.join(root,'site'));
  fs.writeFileSync(path.join(server,'native/places.json'),JSON.stringify({format:1,places:{}}));
  const db=openDb(server);
  const queue=createNativeImports({db,projectRoot:root,environment:{...process.env,ROBLOX_OPEN_CLOUD_API_KEY:'',ROBLOX_ASSET_FETCH:'0',AYA_ASSET_FALLBACK_URL:'',RBX_ASSET_VFS_CONFIG:'',...environment}});
  t.after(async()=>{await queue.close();db.close();fs.rmSync(root,{recursive:true,force:true});});
  return {root,db,queue};
}
function request(bytes){const req=Readable.from([bytes]);req.headers={'content-length':String(bytes.length)};return req;}
async function completed(queue,id){
  const until=Date.now()+30000;
  while(Date.now()<until){const job=queue.get(id);if(!['queued','running','uploading'].includes(job.state))return job;await new Promise(resolve=>setTimeout(resolve,50));}
  throw Error('Import did not finish within the regression timeout');
}
const place=Buffer.from('<roblox version="4"><Item class="Workspace" referent="RBX0"><Properties><string name="Name">Workspace</string></Properties><Item class="Script" referent="RBX1"><Properties><string name="Name">OriginalScript</string><ProtectedString name="Source">print("original gameplay")</ProtectedString></Properties></Item></Item></roblox>');

test('slow upstream discovery releases the registry lock and interruption permits later imports',async t=>{
  let received;
  const pending=new Promise(resolve=>{received=resolve;});
  const server=http.createServer((_req,res)=>{received();res.on('error',()=>{});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const {root,queue,db}=fixture(t,{AYA_ASSET_FALLBACK_URL:'http://127.0.0.1:'+server.address().port});
  const bytes=Buffer.from(place.toString().replace('original gameplay','rbxassetid://87654321'));
  const first=await queue.upload(request(bytes),{slug:'slow-upload',name:'Slow',filename:'slow.rbxlx'},1);
  let timeout;
  try{await Promise.race([pending,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Upstream was not reached')),15000);})]);}
  finally{clearTimeout(timeout);}
  assert.equal(fs.existsSync(path.join(root,'server/native/places.json.import.lock')),false);
  await queue.close();assert.equal(queue.get(first.id).state,'interrupted');
  const next=createNativeImports({db,projectRoot:root,environment:{...process.env,ROBLOX_OPEN_CLOUD_API_KEY:'',ROBLOX_ASSET_FETCH:'0',AYA_ASSET_FALLBACK_URL:'',RBX_ASSET_VFS_CONFIG:''}});
  t.after(()=>next.close());
  const second=await next.upload(request(place),{slug:'later-upload',name:'Later',filename:'later.rbxlx'},1);
  assert.equal((await completed(next,second.id)).state,'succeeded');
});

test('uploaded places automatically use the real importer, preserve bytes and publish dependency reports',async t=>{
  const {root,queue}=fixture(t),meta={slug:'new-upload',name:'Original uploaded place',filename:'historical.rbxlx'};
  const accepted=await queue.upload(request(place),meta,1);
  assert.equal(accepted.sha256,hash(place));
  const job=await completed(queue,accepted.id);assert.equal(job.state,'succeeded',JSON.stringify(job));
  const report=queue.report(job.id);assert.equal(report.placeAnalysis.valid,true);assert.equal(report.placeAnalysis.sha256,hash(place));
  assert.match(report.compatibilityStatus,/^dependencies_(?:partially_)?resolved$/);
  assert.deepEqual(fs.readFileSync(path.join(root,'server/native/maps/new-upload.rbxl')),place);
  assert.deepEqual(fs.readFileSync(path.join(root,'server/native/import-uploads',job.id+'.rbxlx')),place);
  const replacement=Buffer.from(place.toString().replace('original gameplay','different gameplay'));
  const second=await queue.upload(request(replacement),meta,1);
  assert.equal((await completed(queue,second.id)).state,'failed');
  assert.deepEqual(fs.readFileSync(path.join(root,'server/native/maps/new-upload.rbxl')),place);
  const invalid=await queue.upload(request(Buffer.from('<html>not a Roblox place</html>')),{...meta,slug:'invalid-upload'},1);
  assert.equal((await completed(queue,invalid.id)).state,'failed');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'server/native/places.json'))).places['invalid-upload'],undefined);
});

test('upload metadata, request sizes and pending disk reservations are bounded before consuming files',async t=>{
  const {queue,db}=fixture(t),meta={slug:'test',name:'Test',filename:'place.rbxl'};
  for(const bad of [{slug:'../escape'},{filename:'../place.rbxl'},{filename:'place.exe'},{name:'\0hidden'}])
    await assert.rejects(queue.upload(request(place),{...meta,...bad},1),error=>error[0]===400);
  const oversized=request(place);oversized.headers['content-length']=String(128*1024*1024+1);
  await assert.rejects(queue.upload(oversized,meta,1),error=>error[0]===413);
  assert.equal(queue.list().length,0);
  for(let i=0;i<8;i++)db.prepare("INSERT INTO native_imports(id,slug,name,filename,actor_id,state,created_at,updated_at) VALUES (?,?,?,?,?,'uploading',?,?)").run('reserved-'+i,'reserved-'+i,'Reserved','original.rbxl',1,Date.now(),Date.now());
  await assert.rejects(queue.upload(request(place),meta,1),error=>error[0]===429);
  db.prepare('DELETE FROM native_imports').run();
  db.prepare("INSERT INTO native_imports(id,slug,name,filename,actor_id,state,bytes,created_at,updated_at) VALUES ('retained','retained','Retained','original.rbxl',1,'failed',?,?,?)").run(2*1024**3,Date.now(),Date.now());
  await assert.rejects(queue.upload(request(place),meta,1),error=>error[0]===507);
});

test('an in-progress upload reserves its game ID until the original body is retained',async t=>{
  const {queue}=fixture(t),meta={slug:'concurrent-game',name:'Concurrent upload',filename:'original.rbxl'};
  const body=new PassThrough();body.headers={};
  const first=queue.upload(body,meta,1);
  await assert.rejects(queue.upload(request(place),meta,1),error=>error[0]===409);
  body.end(place);
  const job=await first;assert.equal(job.sha256,hash(place));
  assert.equal((await completed(queue,job.id)).state,'succeeded');
});

test('interrupted imports stay explicit after restart instead of claiming completed gameplay',async t=>{
  const {queue,db,root}=fixture(t);
  db.prepare("INSERT INTO native_imports(id,slug,name,filename,actor_id,state,created_at,updated_at) VALUES ('interrupted','game','Game','game.rbxl',1,'running',?,?)").run(Date.now(),Date.now());
  const restarted=createNativeImports({db,projectRoot:root});
  assert.equal(restarted.get('interrupted').state,'interrupted');
  assert.equal(restarted.get('interrupted').reportAvailable,false);
  assert.throws(()=>queue.report('interrupted'),error=>error[0]===404);
  await restarted.close();
});
