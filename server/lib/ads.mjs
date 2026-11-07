// Advertisements are grouped by their original artwork dimensions.
// Existing site/img/ads stays supported, while archive artwork is in
// site/img/userads/{skyscraper,banner,rectangle,feature}.
// Only local artwork is served; no tracking, redirects, or remote images.
import fs from 'node:fs';
import path from 'node:path';

const IMAGE=/\.(?:png|jpe?g|gif|webp|avif)$/i;
const MAX_SIZE=16*1024*1024;
const CATEGORY={skyscraper:'skyscraper',banner:'banner',rectangle:'rectangle',feature:'feature'};
const SLOTS={skyscraper:[160,600],banner:[728,90],rectangle:[300,250],feature:[800,600]};

function pngDimensions(file){
  const fd=fs.openSync(file,'r');
  try{
    const header=Buffer.alloc(24);
    if(fs.readSync(fd,header,0,24,0)!==24)return null;
    if(!header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return null;
    const width=header.readUInt32BE(16),height=header.readUInt32BE(20);
    return width&&height&&width<10000&&height<10000?{width,height}:null;
  }finally{fs.closeSync(fd);}
}
function categoryFor(dimensions, folderCategory){
  // Read PNG dimensions rather than trusting file names or directories.
  if(dimensions){
    const {width,height}=dimensions;
    if(width===160&&height===600)return 'skyscraper';
    if((width===728||width===727)&&height===90)return 'banner';
    if(width===300&&height===250)return 'rectangle';
    if(width===800&&height===600)return 'feature';
    return null;
  }
  return CATEGORY[folderCategory]||'skyscraper'; // legacy WebP ads
}
function readFolder(siteDir,rel,folderCategory){
  const folder=path.join(siteDir,...rel.split('/'));
  try{
    return fs.readdirSync(folder,{withFileTypes:true})
      .filter(entry=>entry.isFile()&&IMAGE.test(entry.name))
      .sort((a,b)=>a.name.localeCompare(b.name))
      .map(entry=>{
        const absolute=path.join(folder,entry.name);
        const stat=fs.lstatSync(absolute);
        if(!stat.isFile()||stat.size<=0||stat.size>MAX_SIZE)return null;
        const dimensions=/\.png$/i.test(entry.name)?pngDimensions(absolute):null;
        const category=categoryFor(dimensions,folderCategory);
        if(!category)return null;
        const [defaultWidth,defaultHeight]=SLOTS[category];
        const width=dimensions?.width??defaultWidth, height=dimensions?.height??defaultHeight;
        const src='/'+rel+'/'+encodeURIComponent(entry.name);
        return {src,category,width,height};
      })
      .filter(Boolean);
  }catch{return [];}
}
export function createAds({siteDir}){
  let cached=[],expires=0;
  return function ads(req,res,url){
    if(url.pathname!=='/api/ads')return false;
    if(req.method!=='GET'&&req.method!=='HEAD'){
      res.writeHead(405,{'Allow':'GET, HEAD'}).end();return true;
    }
    if(Date.now()>=expires){
      const legacy=readFolder(siteDir,'img/ads','skyscraper');
      const archive=Object.keys(CATEGORY).flatMap(category=>readFolder(siteDir,'img/userads/'+category,category));
      // Support archives copied directly into userads, although categorizing
      // them with tools/install-userads.py is recommended.
      const root=readFolder(siteDir,'img/userads',null);
      cached=[...legacy,...archive,...root].slice(0,500);
      expires=Date.now()+15000;
    }
    const groups={skyscraper:[],banner:[],rectangle:[],feature:[]};
    for(const ad of cached)groups[ad.category].push(ad);
    const data=JSON.stringify({images:cached,groups});
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, max-age=15','Content-Length':Buffer.byteLength(data)});
    res.end(req.method==='HEAD'?undefined:data);return true;
  };
}
