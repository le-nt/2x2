import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDb} from '../server/lib/db.mjs';
import {createNative} from '../server/lib/native.mjs';

test('legacy social and pass calls use native XML/raw-string formats, local records and exact worker authorization',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-social-')),db=openDb(dir);
  const insert=db.prepare('INSERT INTO users(id,username,pw_hash,created_at) VALUES(?,?,?,0)');
  for(const id of [101,102,103])insert.run(id,'Local'+id,'test-only');
  const native=createNative({db,cfg:{native:{accessKey:'test-worker'}},root:path.join(dir,'site'),port:8090,
    sessionUser:()=>({}),isGated:()=>false});
  db.prepare("INSERT INTO friendships VALUES(101,102,'accepted',0)").run();
  db.prepare("INSERT INTO friendships VALUES(101,103,'pending',0)").run();
  db.prepare('INSERT INTO native_game_passes VALUES(101,77,0)').run();
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost'),user=req.headers['x-test-session']==='valid'?{id:101}:null;
      if(!native.machine(req,url)&&!user){res.writeHead(401).end();return;}
      if(await native.route(req,res,url,user,'test-session')===false)res.writeHead(404).end();
    }catch{res.writeHead(500).end('Unexpected failure');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{native.close();server.closeAllConnections();await new Promise(r=>server.close(r));db.close();fs.rmSync(dir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const social='/native/Game/LuaWebService/HandleSocialRequest.ashx',pass='/native/Game/GamePass/GamePassHandler.ashx';
  const worker={AccessKey:'test-worker'},session={'x-test-session':'valid'};
  const get=(query,headers=worker,method='GET',route=social)=>fetch(base+route+'?'+new URLSearchParams(query),{headers,method});
  const query={method:'GetGroupRank',playerid:'101',groupid:'42'};
  assert.equal((await get(query,{})).status,401);
  assert.equal((await get(query,{AccessKey:'wrong'})).status,401);
  assert.equal((await get(query,worker,'GET',social+'/extra')).status,401);
  assert.equal((await get(query,worker,'GET','/api/me')).status,401);
  assert.equal((await get(query,worker,'POST')).status,405);
  assert.equal((await get({...query,playerid:'102'},session)).status,403);
  assert.equal((await get({...query,playerid:'999'})).status,404);
  for(const playerid of ['0','-1','1e2','2147483648','101junk'])assert.equal((await get({...query,playerid})).status,400);
  assert.equal((await get({...query,method:'Unknown'})).status,400);
  assert.equal((await fetch(base+social+'?method=GetGroupRank&method=IsInGroup&playerid=101&groupid=42',{headers:worker})).status,400);
  const response=await get(query);assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/^application\/xml/);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(await response.text(),'<Value Type="integer">0</Value>');
  const check=async(q,expected,route=social)=>assert.equal(await(await get(q,worker,'GET',route)).text(),expected);
  await check({...query,method:'GetGroupRole'},'Guest');
  await check({...query,method:'IsInGroup'},'<Value Type="boolean">false</Value>');
  await check({...query,groupid:'43'},'<Value Type="integer">0</Value>');
  await check({...query,method:'GetGroupRole',groupid:'43'},'Guest');
  await check({...query,method:'IsInGroup',groupid:'43'},'<Value Type="boolean">false</Value>');
  for(const [playerid,userid,expected] of [[101,102,true],[102,101,true],[101,103,false],[101,101,false],[101,999,false]])
    await check({method:'IsFriendsWith',playerid,userid},`<Value Type="boolean">${expected}</Value>`);
  await check({method:'IsBestFriendsWith',playerid:101,userid:102},'<Value Type="boolean">false</Value>');
  await check({Action:'HasPass',UserID:101,PassID:77},'<Value Type="boolean">true</Value>',pass);
  await check({Action:'HasPass',UserID:102,PassID:77},'<Value Type="boolean">false</Value>',pass);
  await check({Action:'HasPass',UserID:101,PassID:78},'<Value Type="boolean">false</Value>',pass);
  assert.equal((await get({Action:'Purchase',UserID:101,PassID:77},worker,'GET',pass)).status,400);
  assert.equal((await get({Action:'HasPass',UserID:102,PassID:77},session,'GET',pass)).status,403);
});
