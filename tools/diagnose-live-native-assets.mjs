#!/usr/bin/env node
// Non-destructive diagnostics for /native/content-asset delivery.
// Never use or print the Open Cloud API key, cookies or signed URLs.
import fs from 'node:fs';
import path from 'node:path';
const argv=process.argv.slice(2);
const get=(name, fallback)=>{const at=argv.indexOf(name);return at<0?fallback:argv[at+1];};
if(argv.includes('--help')){
 console.log('node tools/diagnose-live-native-assets.mjs --public https://2x2.lentanyl.com --local http://127.0.0.1:3000 --ids 1029523,1034290 --timeout 15000');
 process.exit(0);
}
const publicBase=get('--public','https://2x2.lentanyl.com');
const localBase=get('--local',null);
const ids=get('--ids','1029523,1034290').split(',').filter(Boolean);
const timeout=Number(get('--timeout','15000'));
if(!ids.length || !ids.every(id=>/^[1-9]\d{0,15}$/.test(id)))throw Error('Supply numeric IDs with --ids');
if(!Number.isInteger(timeout)||timeout<1000||timeout>60000)throw Error('Timeout must be 1000-60000 ms');
for(const base of [publicBase,localBase].filter(Boolean)){
 const url=new URL(base);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Use a base origin without credentials, path or query');
 if(base===localBase&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('--local must use localhost/loopback');
}
const cache=path.resolve('server/native/asset-cache');
const seed=path.resolve('server/native/asset-seed');
for(const id of ids){
 const localFiles=[cache,seed].flatMap(dir=>['','.mesh','.rbxm','.png','.jpg'].map(ext=>path.join(dir,id+ext))).filter(file=>{try{return fs.statSync(file).isFile();}catch{return false;}});
 console.log('ASSET',id,'cached locally:',localFiles.length?'yes ('+localFiles.length+' files)':'not in cache/seed');
}
const bases=[['PUBLIC',publicBase],...(localBase?[['LOCAL',localBase]]:[])];
for(const [label,base] of bases)for(const id of ids){
 const url=new URL('/native/content-asset?id='+id,base);
 const start=performance.now();
 try{
  const response=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(timeout),headers:{'Accept':'*/*'}});
  // Do not dump potentially huge bodies; ensure the stream completes so a stalled response is identified.
  let bytes=0;
  if(response.body){
   for await(const chunk of response.body)bytes+=chunk.byteLength;
  }
  console.log(label,id,'HTTP',response.status,'elapsed_ms',Math.round(performance.now()-start),'bytes',bytes,'content_type',response.headers.get('content-type')||'-','reason',response.headers.get('x-2x2-asset-reason')||'-');
 }catch(error){
  console.log(label,id,'FAILED',error.name||'Error','elapsed_ms',Math.round(performance.now()-start));
 }
}
