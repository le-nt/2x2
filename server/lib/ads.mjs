// A small local image rotation. Adding files to site/img/ads needs no manifest edits.
import fs from 'node:fs';
import path from 'node:path';

const IMAGE=/\.(?:png|jpe?g|gif|webp|avif)$/i;
export function createAds({siteDir}){
  const folder=path.join(siteDir,'img','ads');
  let cached=[],expires=0;
  return function ads(req,res,url){
    if(url.pathname!=='/api/ads')return false;
    if(req.method!=='GET'&&req.method!=='HEAD'){
      res.writeHead(405,{'Allow':'GET, HEAD'}).end();return true;
    }
    if(Date.now()>=expires){
      try{
        cached=fs.readdirSync(folder,{withFileTypes:true})
          .filter(file=>file.isFile()&&IMAGE.test(file.name))
          .map(file=>file.name).sort().slice(0,500)
          .filter(name=>{const size=fs.statSync(path.join(folder,name)).size;return size>0&&size<=16*1024*1024;})
          .map(name=>({src:'/img/ads/'+encodeURIComponent(name)}));
      }catch{cached=[];}
      expires=Date.now()+15000;
    }
    const data=JSON.stringify({images:cached});
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, max-age=15','Content-Length':Buffer.byteLength(data)});
    res.end(req.method==='HEAD'?undefined:data);return true;
  };
}
