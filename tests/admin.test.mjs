import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import crypto from "node:crypto";
import { openDb } from "../server/lib/db.mjs";
import { createAdmin } from "../server/lib/admin.mjs";
import { hashPassword } from "../server/lib/auth.mjs";

function fromBase32(value) {
  const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let acc=0,bits=0;const out=[];
  for(const ch of value){acc=(acc<<5)|chars.indexOf(ch);bits+=5;if(bits>=8){bits-=8;out.push((acc>>>bits)&255);}}
  return Buffer.from(out);
}
function otp(value) {
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const mac=crypto.createHmac("sha1",fromBase32(value)).update(counter).digest();
  const off=mac[19]&15;
  return String((mac.readUInt32BE(off)&0x7fffffff)%1000000).padStart(6,"0");
}
function request(method, path, data) {
  const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]);
  req.method=method;req.headers={host:"localhost:8080",origin:"http://localhost:8080",
    "content-type":"application/json"};
  const result={status:0,headers:{},body:null};
  const res={
    writeHead(status,headers){result.status=status;Object.assign(result.headers,headers);return this;},
    setHeader(key,value){result.headers[key]=value;},
    end(body){result.body=body?JSON.parse(body):null;}
  };
  return {req,res,url:new URL(path,"http://localhost:8080"),result};
}
test("admin port requires role and TOTP, audits enforcement and controls live flags",async t=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),"2x2-admin-"));
  const db=openDb(dir);
  t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
  const pw=await hashPassword("OwnerPassword42");
  db.prepare("INSERT INTO users(id,username,pw_hash,created_at) VALUES (1,'Owner',?,?)").run(pw,Date.now());
  db.prepare("INSERT INTO users(id,username,pw_hash,created_at) VALUES (2,'Player',?,?)").run(pw,Date.now());
  const owner=db.prepare("SELECT * FROM users WHERE id=1").get();
  const player=db.prepare("SELECT * FROM users WHERE id=2").get();
  const cfg={secret:"test_secret_123",admins:[]};
  const admin=createAdmin({db,cfg,secure:false});
  async function send(user,method,path,body,cookies={},webHash="test-session"){
    const call=request(method,"/api/admin"+path,body);
    await admin.handle(call.req,call.res,call.url,user,webHash,cookies,"127.0.0.1");
    return call.result;
  }
  assert.equal((await send(player,"GET","/status")).status,403);
  assert.equal((await send(owner,"GET","/dashboard")).status,403);
  assert.equal((await send(owner,"POST","/totp/setup",{password:"wrong"})).status,403);
  const setup=await send(owner,"POST","/totp/setup",{password:"OwnerPassword42"});
  assert.equal(setup.status,200);
  assert.match(setup.body.secret,/^[A-Z2-7]+$/);
  const enroll=await send(owner,"POST","/totp/enroll",{code:otp(setup.body.secret)});
  assert.equal(enroll.status,200);
  const token=decodeURIComponent(enroll.headers["Set-Cookie"].split(";")[0].split("=")[1]);
  assert.ok(token);
  assert.equal((await send(owner,"GET","/dashboard",undefined,{rbxcsa:token},"wrong-web-session")).status,403);
  assert.equal((await send(owner,"GET","/dashboard",undefined,{rbxcsa:token})).status,200);
  assert.equal((await send(owner,"POST","/staff",{userId:2,role:"Moderator"},{rbxcsa:token})).status,200);
  assert.equal(admin.role(player),"Moderator");
  assert.equal((await send(owner,"POST","/users/2/action",{action:"Ban_1Day",reason:"Moderation test"},{rbxcsa:token})).status,200);
  assert.ok(admin.activeBan(2));
  assert.equal((await send(owner,"POST","/users/2/action",{action:"Unban",reason:"Appeal accepted"},{rbxcsa:token})).status,200);
  assert.equal(admin.activeBan(2),null);
  assert.equal((await send(owner,"POST","/features/registration",{enabled:false},{rbxcsa:token})).status,200);
  assert.equal(db.prepare("SELECT enabled FROM site_features WHERE key='registration'").get().enabled,0);
  assert.equal((await send(owner,"GET","/audit",undefined,{rbxcsa:token})).status,200);
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM admin_audit").get().n>=4);
  assert.equal((await send(owner,"POST","/logout",{}, {rbxcsa:token})).status,200);
  assert.equal((await send(owner,"GET","/dashboard",undefined,{rbxcsa:token})).status,403);
});
