import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createAds} from '../server/lib/ads.mjs';

test('ad discovery lists only bounded regular image files and URL-encodes names',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-ads-'));
  const dir=path.join(root,'img/ads');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'friend "art".PNG'),'png fixture');
  fs.writeFileSync(path.join(dir,'poster.webp'),'webp fixture');
  fs.writeFileSync(path.join(dir,'README.md'),'instructions');
  fs.writeFileSync(path.join(dir,'script.svg'),'<svg/>');
  fs.writeFileSync(path.join(dir,'empty.jpg'),'');
  fs.mkdirSync(path.join(dir,'not-an-image.png'));
  fs.writeFileSync(path.join(root,'private.png'),'secret');
  fs.symlinkSync(path.join(root,'private.png'),path.join(dir,'symlink.png'));
  const handle=createAds({siteDir:root});
  const server=http.createServer((req,res)=>{if(!handle(req,res,new URL(req.url,'http://localhost')))res.writeHead(404).end();});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const r=await fetch(base+'/api/ads');
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.images.length,2);
  assert.deepEqual(data.images.map(x=>x.src),['/img/ads/friend%20%22art%22.PNG','/img/ads/poster.webp']);
  assert.equal(data.groups.skyscraper.length,2);
  const head=await fetch(base+'/api/ads',{method:'HEAD'});
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(base+'/api/ads',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/api/ads/extra')).status,404);
});

test('archive ad artwork groups by measured PNG dimensions',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-userads-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const png=(width,height)=>{
    const data=Buffer.alloc(24);
    Buffer.from([137,80,78,71,13,10,26,10]).copy(data);
    data.write('IHDR',12,'ascii');
    data.writeUInt32BE(width,16);data.writeUInt32BE(height,20);
    return data;
  };
  for(const [category,w,h] of [
    ['skyscraper',160,600],['banner',728,90],['banner',727,90],
    ['rectangle',300,250],['feature',800,600]
  ]){
    const dir=path.join(root,'img','userads',category);
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,w+'x'+h+'.png'),png(w,h));
  }
  const handle=createAds({siteDir:root});
  let result;
  const res={writeHead(){return this;},end(data){result=JSON.parse(data);}};
  assert.equal(handle({method:'GET'},res,new URL('https://2x2.example/api/ads')),true);
  assert.equal(result.images.length,5);
  assert.equal(result.groups.skyscraper.length,1);
  assert.equal(result.groups.banner.length,2);
  assert.equal(result.groups.rectangle.length,1);
  assert.equal(result.groups.feature.length,1);
  assert.deepEqual(result.groups.banner.map(x=>x.width).sort(),[727,728]);
});
