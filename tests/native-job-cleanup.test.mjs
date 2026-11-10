import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createNative} from '../server/lib/native.mjs';
import {createNativeJobCleanup} from '../server/lib/native-job-cleanup.mjs';

function fixture(t){
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE native_jobs(job_id TEXT PRIMARY KEY,last_heartbeat INTEGER NOT NULL,closed INTEGER NOT NULL DEFAULT 0)');
  t.after(()=>db.close());
  return {db,add:(id,time,closed=0)=>db.prepare('INSERT INTO native_jobs VALUES(?,?,?)').run(id,time,closed),
    pending:()=>db.prepare('SELECT job_id FROM native_job_cleanup ORDER BY job_id').all().map(r=>r.job_id)};
}

test('restart retires previous workers, persists pending cleanup, and preserves freshly heartbeating jobs',async t=>{
  const {db,add,pending}=fixture(t);let time=200000,calls=[];
  add('before-restart',time);add('already-closed',0,1);
  let cleanup=createNativeJobCleanup({db,now:()=>time,stopJob:async id=>{calls.push(id);throw Error('offline');}});
  assert.deepEqual(pending(),['before-restart']);
  assert.equal(db.prepare('SELECT closed FROM native_jobs WHERE job_id=?').get('before-restart').closed,1);
  await cleanup.tick();cleanup.close();
  // A second web restart retries the persisted queue, respecting its backoff.
  cleanup=createNativeJobCleanup({db,now:()=>time,stopJob:async id=>{calls.push(id);return {success:true};}});
  t.after(()=>cleanup.close());await cleanup.tick();assert.deepEqual(calls,['before-restart']);
  time+=15000;await cleanup.tick();assert.deepEqual(calls,['before-restart','before-restart']);assert.deepEqual(pending(),[]);
  add('current-player',time);add('lost-heartbeat',time-120001);
  await cleanup.tick();assert.equal(calls.at(-1),'lost-heartbeat');
  assert.equal(db.prepare('SELECT closed FROM native_jobs WHERE job_id=?').get('current-player').closed,0);
});

test('cleanup bounds concurrency and timeouts, and failing workers do not starve later requests',async t=>{
  const {db,add,pending}=fixture(t);let time=200000,running=0,peak=0;const calls=[];
  for(const id of ['a','b','c','d'])add(id,time);
  const cleanup=createNativeJobCleanup({db,now:()=>time,timeoutMs:25,stopJob:async(id,signal)=>{
    calls.push(id);running++;peak=Math.max(peak,running);
    try{await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}
    finally{running--;}
  }});t.after(()=>cleanup.close());
  // Keep the event loop alive while AbortSignal.timeout's unreferenced timer fires.
  const alive=setInterval(()=>{},100);t.after(()=>clearInterval(alive));
  await Promise.all([cleanup.tick(),cleanup.tick()]);assert.equal(peak,2);assert.equal(running,0);
  assert.deepEqual(calls,['a','b']);
  await cleanup.tick();assert.deepEqual(calls,['a','b','c','d']);assert.equal(pending().length,4);
  await cleanup.tick();assert.equal(calls.length,4,'backoff prevents retry storms');
  time+=15000;await cleanup.tick();assert.equal(calls.length,6);
});

test('early shutdown survives registration races; closing aborts requests without losing retirement',async t=>{
  const {db,add,pending}=fixture(t);let time=200000,registered=false;
  const cleanup=createNativeJobCleanup({db,now:()=>time,stopJob:async()=>({success:registered,message:'Job ID not found'})});
  cleanup.request('boot-failed');await cleanup.tick();assert.deepEqual(pending(),['boot-failed']);
  assert.equal(cleanup.pending('boot-failed'),true);
  add('boot-failed',time);cleanup.request('boot-failed');registered=true;time+=15000;await cleanup.tick();assert.deepEqual(pending(),[]);
  assert.equal(db.prepare('SELECT closed FROM native_jobs WHERE job_id=?').get('boot-failed').closed,1);
  cleanup.request('absent');registered=false;await cleanup.tick();time+=120000;await cleanup.tick();assert.deepEqual(pending(),[]);
  cleanup.close();
  let aborted=false;
  const second=createNativeJobCleanup({db,now:()=>time,stopJob:async(id,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);},{once:true}))});
  second.request('shutdown-pending');const task=second.tick();second.close();await task;
  assert.equal(aborted,true);assert.deepEqual(pending(),['shutdown-pending']);
});

test('a shutdown callback during OpenJob never advertises the failed worker to players',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-startup-shutdown-'));
  const db=new DatabaseSync(':memory:');let native,app,worker,appPort,stopCalls=0;
  t.after(async()=>{
    native?.close();for(const server of [app,worker])if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
    db.close();fs.rmSync(dir,{recursive:true,force:true});
  });
  fs.mkdirSync(path.join(dir,'site'),{recursive:true});fs.mkdirSync(path.join(dir,'server/native/maps'),{recursive:true});
  fs.writeFileSync(path.join(dir,'server/native/maps/test.rbxl'),'unchanged fixture place');
  fs.writeFileSync(path.join(dir,'server/native/places.json'),JSON.stringify({places:{fixture:{id:1,file:'test.rbxl'}}}));
  worker=http.createServer(async(req,res)=>{
    assert.equal(req.headers.accesskey,'fixture-worker');for await(const _ of req){}
    if(req.url==='/gameserver/new'){
      const shutdown=await fetch(`http://127.0.0.1:${appPort}/native/internal/gameserver/shutdown`,{
        method:'POST',headers:{AccessKey:'fixture-worker','Content-Type':'application/json'},body:JSON.stringify({jobId:'failed-during-open'})});
      assert.equal(shutdown.status,200);
      res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({success:true,job_id:'failed-during-open'}));
    }else if(req.url==='/gameserver/reported-closed'){
      stopCalls++;res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({success:false,message:'Job ID not found'}));
    }else{res.writeHead(500).end('Failed workers must not be renewed');}
  });
  await new Promise(r=>worker.listen(0,'127.0.0.1',r));
  native=createNative({db,cfg:{native:{accessKey:'fixture-worker',arbiterOrigin:`http://127.0.0.1:${worker.address().port}`}},
    root:path.join(dir,'site'),port:8090,sessionUser:()=>({}),isGated:()=>false});
  app=http.createServer(async(req,res)=>{
    try{if(await native.route(req,res,new URL(req.url,'http://localhost'),{id:1},'fixture-session')===false)res.writeHead(404).end();}
    catch(error){res.writeHead(500).end(error.message);}
  });
  await new Promise(r=>app.listen(0,'127.0.0.1',r));appPort=app.address().port;
  const launch=()=>fetch(`http://127.0.0.1:${appPort}/native/game/placelauncher?placeId=1`,{method:'POST'});
  assert.equal((await(await launch()).json()).status,0);
  let failed=false;
  for(let i=0;i<100;i++){
    const response=await launch(),data=await response.json();
    assert.notEqual(data.status,2,'A failed worker must never produce a join ticket');
    if(response.status===503){assert.match(data.message,/shut down during startup/);failed=true;break;}
    await new Promise(r=>setTimeout(r,10));
  }
  assert.equal(failed,true);assert.equal(stopCalls,1);
  assert.equal(db.prepare('SELECT closed FROM native_jobs WHERE job_id=?').get('failed-during-open').closed,1);
  assert.ok(db.prepare('SELECT 1 FROM native_job_cleanup WHERE job_id=?').get('failed-during-open'),'Early cleanup remains retryable');
});
