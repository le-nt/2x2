import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data=mkdtempSync(join(tmpdir(),'2x2-test-'));
const child=spawn(process.execPath,[join(root,'server/server.mjs'),'18973'],{env:{...process.env,RBX_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data', c=>output+=c);child.stderr.on('data',c=>output+=c);
const base='http://localhost:18973';let cookie='';
async function request(path, options={}) {
 const response=await fetch(base+path,{...options,redirect:'manual',headers:{Cookie:cookie,...options.headers}});
 for(const line of response.headers.getSetCookie()) cookie += (cookie?'; ':'')+line.split(';')[0];
 return response;
}
try {
 let ready=false;
 for(let i=0;i<80;i++){try{await fetch(base);ready=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}
 assert.ok(ready,output);
 assert.equal((await request('/')).status,401);
 const cfg=JSON.parse(readFileSync(join(root,'server/config.json')));
 assert.equal((await request('/?key='+encodeURIComponent(cfg.accessToken))).status,303);
 assert.equal((await request('/api/native-launch?id=x')).status,401);
 assert.equal((await request('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'SmokeUser',password:'SmokePass123!'})})).status,200);
 assert.equal((await request('/api/me')).status,200);
 for(const page of ['index','home','games','settings','chat','play']){
  const r=await request('/'+page+'.html');assert.equal(r.status,200,page);const text=await r.text();assert.ok(!text.includes('js/desktop.js'),page);assert.ok(!text.includes('RBXBanland'),page);
 }
 const map=JSON.parse(readFileSync(join(root,'site/data/maps.json'))).maps[0];
 assert.equal((await request('/api/native-launch?id='+encodeURIComponent(map.id))).status,503);
 assert.equal((await request('/api/native-launch?id=unknown')).status,404);
 assert.equal((await request('/js/desktop.js')).status,404);
 console.log('HTTP smoke checks passed: gate, registration, session, pages, native errors, removed shell.');
} finally { if(child.exitCode === null){const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;}rmSync(data,{recursive:true,force:true}); }
