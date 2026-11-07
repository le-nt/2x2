import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createNative} from '../server/lib/native.mjs';

test('native chat uses worker authorization, legacy response keys and bounded local filtering',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-native-chat-'));
  // No game worker or real account database is required to exercise HTTP routing.
  const db={exec(){},prepare(sql){return {
    run(){},get(id){return sql.includes('FROM users WHERE id=')&&id===2?{id:2}:undefined;}
  };}};
  const native=createNative({db,cfg:{native:{accessKey:'worker-secret',chat:{blockedTerms:['bad.word']}}},
    root,port:8090,sessionUser:()=>({}),isGated:()=>false});
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      // Simulate a previously authenticated browser; raw worker credentials remain real.
      const user=req.headers['x-test-session']==='valid'?{id:2}:null;
      if(!native.machine(req,url)&&!user){res.writeHead(401).end();return;}
      if(await native.route(req,res,url,user,'session')===false)res.writeHead(404).end();
    }catch(error){res.writeHead(500).end(error.message);}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{native.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const get=(p,headers={})=>fetch(base+p,{headers});
  const metadata='/native/api/game/players/2',filter='/native/api/moderation/filtertext';
  const worker={AccessKey:'worker-secret'};
  assert.equal((await get(metadata)).status,401);
  assert.equal((await get(metadata,{AccessKey:'wrong'})).status,401);
  assert.deepEqual(await(await get(metadata,worker)).json(),{ChatFilter:'blacklist'});
  assert.deepEqual(await(await get(metadata,{'x-test-session':'valid'})).json(),{ChatFilter:'blacklist'});
  assert.equal((await get('/native/api/game/players/3',{'x-test-session':'valid'})).status,403);
  assert.equal((await get('/native/api/game/players/3',worker)).status,404);
  assert.equal((await get(metadata+'/extra',worker)).status,401,'worker allowlist must match the complete path');
  assert.equal((await get('/api/me',worker)).status,401,'chat does not broaden worker access');
  assert.equal((await get(filter,worker)).status,405);
  const post=(body,headers=worker)=>fetch(base+filter,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...headers},body});
  assert.equal((await post('text=hello',{'x-test-session':'valid'})).status,403);
  assert.deepEqual(await(await post('filters=white&filters=black&text=hello+there')).json(),{data:{white:'hello there',black:'hello there'}});
  assert.deepEqual(await(await post(gzipSync('userId=2&text=BAD.word+badXword'),{...worker,'Content-Encoding':'gzip'})).json(),
    {data:{white:'######## badXword',black:'######## badXword'}});
  assert.equal((await post('userId=3&text=hello')).status,400);
  assert.equal((await post('userId=2&userId=3&text=hello')).status,400);
  assert.equal((await post('text=one&text=two')).status,400);
  assert.equal((await post('text='+ 'a'.repeat(401))).status,400);
  assert.equal((await post('text='+ 'a'.repeat(65536))).status,413);
  assert.equal((await post('text=hello',{...worker,'Content-Type':'application/json'})).status,415);
  assert.equal((await post(Buffer.from('not gzip'),{...worker,'Content-Encoding':'gzip'})).status,400);
  for(let i=0;i<5;i++)assert.equal((await post('userId=2&text=hello')).status,200);
  assert.equal((await post('userId=2&text=too+many')).status,429);
});
