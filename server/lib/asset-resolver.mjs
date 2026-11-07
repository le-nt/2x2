// Offline numeric Roblox asset resolver. Never proxies arbitrary network addresses.
import fs from 'node:fs';
import path from 'node:path';

const extensions = ['.rbxm', '.rbxmx', '.mesh', '.png', '.jpg', '.jpeg', '.dds', '.wav', '.mp3', '.ogg', '.txt'];
const types = {'.rbxm':'application/octet-stream','.rbxmx':'application/xml','.mesh':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.dds':'application/octet-stream','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.txt':'text/plain; charset=utf-8'};
const allowed = new Set(extensions);
function validId(value) {return typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value) && Number.isSafeInteger(Number(value));}
function safeFile(base, name) {
  try {
    const root = fs.realpathSync(base);
    const candidate = fs.realpathSync(path.join(root, name));
    if (!candidate.startsWith(root+path.sep)) return null;
    const stat = fs.statSync(candidate);
    if (!stat.isFile() || stat.size > 64*1024*1024) return null;
    return candidate;
  } catch {return null;}
}
export function createAssetResolver({serverDir, siteDir}) {
  const roots = [
    {dir:path.join(serverDir,'native','asset-library'), prefix:''},
    {dir:path.join(siteDir,'data','scenes','assets'), prefix:'assets_'},
  ];
  function lookup(id) {
    if (!validId(id)) return null;
    for(const {dir,prefix} of roots) for(const ext of extensions) {
      const file = safeFile(dir, prefix+id+ext);
      if(file) return {file,ext};
    }
    return null;
  }
  function handle(req,res,url) {
    if(url.pathname !== '/api/asset') return false;
    if(req.method !== 'GET' && req.method !== 'HEAD') {res.writeHead(405,{'Allow':'GET, HEAD'}).end(); return true;}
    const id = url.searchParams.get('id');
    if(!validId(id)) {res.writeHead(400,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:'Invalid asset ID.'}));return true;}
    const found = lookup(id);
    if(!found) {
      console.warn(`[2x2 assets] Missing local asset ID ${id}`);
      res.writeHead(404,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:'Asset not present in local asset library.',id,expectedDirectory:'server/native/asset-library',supportedExtensions:extensions}));
      return true;
    }
    const size=fs.statSync(found.file).size;
    res.writeHead(200,{'Content-Type':types[found.ext], 'Content-Length':size,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(found.file).pipe(res);
    return true;
  }
  return {lookup,handle};
}
