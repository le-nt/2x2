// Offline Roblox asset resolver. AyaEX-inspired local-first lookup, bounded
// negative cache, and XML-only URL substitution. Bounded on-demand upstream fallback.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fetchRobloxOpenCloudAsset,fetchRobloxLegacyAsset,retryAfterMs} from './roblox-open-cloud.mjs';

const extensions = ['.rbxm', '.rbxmx', '.mesh', '.png', '.jpg', '.jpeg', '.dds', '.wav', '.mp3', '.ogg', '.txt', '.lua', ''];
const types = {'.rbxm':'application/octet-stream','.rbxmx':'application/xml','.mesh':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.dds':'application/octet-stream','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.txt':'text/plain; charset=utf-8','.lua':'text/plain; charset=utf-8'};
const MAX_FILE = 64 * 1024 * 1024;
const MISS_TTL = 15000;
const MISS_LIMIT = 2048;
const MAX_DOWNLOAD = 32 * 1024 * 1024;
const MAX_CONCURRENT = 6;
const MAX_WAITING = 120;
const UPSTREAM_MISS_TTL = 5 * 60 * 1000;
function upstreamURL(base, id) {
  if (!base) return null;
  try {
    const url = new URL(base);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)))
      return null;
    url.pathname = url.pathname.replace(/\/+$/, '') + '/asset/';
    url.searchParams.set('id', id);
    return url;
  } catch { return null; }
}
function trustedRobloxRedirect(url) {
  return url.protocol === 'https:' && !url.username && !url.password &&
    (url.hostname === 'assetdelivery.roblox.com' || url.hostname.endsWith('.rbxcdn.com'));
}
async function downloadBytes(startURL, {roblox = false, report = () => {}, headers = {},fetchImpl=fetch,onResponse=()=>{}} = {}) {
  let url = new URL(startURL);
  const abort = AbortSignal.timeout(12000);
  for (let redirects = 0; redirects < 4; redirects++) {
    if (roblox && !trustedRobloxRedirect(url)) { report('untrusted_redirect'); return null; }
    const response = await fetchImpl(url, {redirect:'manual', signal:abort, headers});
    onResponse(response);
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) { report('redirect_without_location'); return null; }
      const next = new URL(location, url);
      if (roblox ? !trustedRobloxRedirect(next) : next.origin !== url.origin) { report('redirect_blocked'); return null; }
      url = next;
      continue;
    }
    if (!response.ok || !response.body) { report('HTTP_' + response.status); return null; }
    const length = Number(response.headers.get('content-length') || 0);
    if (!Number.isFinite(length) || length > MAX_DOWNLOAD) { report('content_too_large'); return null; }
    const parts = [];
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > MAX_DOWNLOAD) { report('stream_too_large'); return null; }
      parts.push(chunk);
    }
    if (!total) { report('empty_body'); return null; }
    const result = Buffer.concat(parts, total);
    const prefix = result.subarray(0, 128).toString('utf8');
    if (/^\s*(?:<!doctype html|<html\b|\{\s*"(?:errors|error|message)"\s*:)/i.test(prefix)) { report('error_document'); return null; }
    return result;
  }
  report('too_many_redirects');
  return null;
}
function trimCache(dir, limit, keep) {
  try {
    const entries = fs.readdirSync(dir)
      .filter(name => /^[1-9]\d{0,15}(?:\.v[1-9]\d{0,15})?$/.test(name))
      .map(name => { const file = path.join(dir,name), stat = fs.statSync(file); return {file,stat}; })
      .filter(e => e.stat.isFile()).sort((a,b) => a.stat.mtimeMs - b.stat.mtimeMs);
    let size = entries.reduce((total,e) => total + e.stat.size, 0);
    for (const e of entries) {
      if (size <= limit) break;
      if (e.file === keep) continue;
      fs.unlinkSync(e.file);
      size -= e.stat.size;
    }
  } catch (error) { console.warn('[2x2 assets] Cache cleanup failed:', error.message); }
}
function validId(value) { return typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value) && Number.isSafeInteger(Number(value)); }
export function validAssetVersion(value) {return value===null || validId(String(value));}
function assetKey(id,version=null){return version===null?id:id+'.v'+String(version);}
function publishImmutable(file,bytes) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temporary=file+'.'+crypto.randomUUID()+'.tmp';
  try {
    fs.writeFileSync(temporary,bytes,{flag:'wx'});
    try{fs.linkSync(temporary,file);}catch(error){if(error.code!=='EEXIST')throw error;}
  } finally{try{fs.unlinkSync(temporary);}catch{}}
  return fs.readFileSync(file).equals(bytes);
}
function safeFile(base, name) {
  try {
    const root = fs.realpathSync(base);
    const candidate = fs.realpathSync(path.join(root, name));
    if (!candidate.startsWith(root + path.sep)) return null;
    const stat = fs.statSync(candidate);
    if (!stat.isFile() || stat.size > MAX_FILE) return null;
    return {file:candidate, size:stat.size,mtimeMs:stat.mtimeMs};
  } catch { return null; }
}
function xmlText(file, ext, maxBytes) {
  if (ext !== '.rbxmx' && ext !== '.rbxm') return null;
  const fd = fs.openSync(file, 'r');
  try {
    const prefix = Buffer.alloc(256);
    const len = fs.readSync(fd, prefix, 0, prefix.length, 0);
    if (!/^\s*(?:<\?xml\b|<roblox\b)/i.test(prefix.subarray(0, len).toString('utf8'))) return null;
  } finally { fs.closeSync(fd); }
  if (maxBytes > MAX_FILE) return null;
  return fs.readFileSync(file, 'utf8');
}
export function rewriteLegacyAssetUrls(xml, publicOrigin) {
  if (!publicOrigin) return xml;
  let origin;
  try {
    const url = new URL(publicOrigin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        !['/', '/native'].includes(url.pathname) || url.search || url.hash) return xml;
    origin = url.origin + (url.pathname === '/native' ? '/native' : '');
  } catch { return xml; }
  // Rewrite asset references only; keep external URLs and non-XML binaries intact.
  const target = id => origin + (origin.endsWith('/native') ? '/content-asset?id=' : '/api/asset?id=') + id;
  return xml
    .replace(/https?:\/\/(?:(?:www\.)?roblox\.com\/asset\/?|(?:www\.)?projectpizza\.net\/api\/asset\/?)\?id=([1-9]\d{0,15})(?=[^0-9]|$)/gi,
      (match, id) => validId(id) ? target(id) : match)
    // Old archived places use rbxasset://../../../shareddata/assets/<id>.
    // This is a local-file locator, so the HTTP URL redirect in the engine
    // cannot rewrite it. Translate only the exact numeric shareddata pattern.
    .replace(/h?rbxasset:\/\/(?:\.\.\/)*shareddata\/(?:assets|SBCR)\/([1-9]\d{0,15})(?![A-Za-z0-9._/-])/gi,
      (match, id) => validId(id) ? target(id) : match);
}

// AyaEX libraries may store an asset as just its numeric ID with no extension.
// Sniff only enough bytes to classify the response, without modifying its payload.
function detectExtension(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(256);
  let length;
  try { length = fs.readSync(fd, head, 0, head.length, 0); }
  finally { fs.closeSync(fd); }
  const b = head.subarray(0,length);
  if (b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return '.png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
  if (b.subarray(0,4).toString('latin1') === 'DDS ') return '.dds';
  if (b.subarray(0,4).toString('latin1') === 'RIFF' && b.subarray(8,12).toString('latin1') === 'WAVE') return '.wav';
  if (b.subarray(0,4).toString('latin1') === 'OggS') return '.ogg';
  if (b.subarray(0,3).toString('ascii') === 'ID3' || b[0]===0xff && (b[1]&0xe0)===0xe0) return '.mp3';
  if (/^version \d+\.\d+/.test(b.toString('ascii'))) return '.mesh';
  if (/^\s*(?:<\?xml[^>]*>\s*)?<roblox(?:\s|>)/i.test(b.toString('utf8'))) return '.rbxmx';
  return '.rbxm';
}

export function createAssetResolver({serverDir, siteDir, publicOrigin = '',fetchImpl=fetch,clock=()=>performance.now()}) {
  const cacheDir = path.join(serverDir, 'native', 'asset-cache');
  const seedDir = path.join(serverDir, 'native', 'asset-seed');
  const metadataDir=path.join(serverDir,'native','asset-metadata');
  const verifiedHashes=new Map(),cooldowns=new Map(),sharedTransfers=new Map();
  const beforeRequest=url=>Math.max(0,(cooldowns.get(url.hostname)||0)-clock());
  const onRateLimit=(host,delay)=>cooldowns.set(host,Math.max(cooldowns.get(host)||0,clock()+delay));
  function archivedMetadata(id,version,found) {
    try {
      const info=safeFile(metadataDir,assetKey(id,version)+'.json');if(!info||info.size>8192)return null;
      const meta=JSON.parse(fs.readFileSync(info.file,'utf8'));
      if(meta.schemaVersion!==1 || meta.assetId!==id || meta.requestedVersion!==(version===null?null:Number(version)) ||
        !/^[a-f0-9]{64}$/.test(meta.sha256)||meta.bytes!==found.size)return null;
      let cached=verifiedHashes.get(found.file);
      if(!cached || cached.size!==found.size || cached.mtimeMs!==found.mtimeMs) {
        cached={size:found.size,mtimeMs:found.mtimeMs,hash:crypto.createHash('sha256').update(fs.readFileSync(found.file)).digest('hex')};
        if(verifiedHashes.size>=1024)verifiedHashes.delete(verifiedHashes.keys().next().value);
        verifiedHashes.set(found.file,cached);
      }
      return cached.hash===meta.sha256?meta:null;
    }catch{return null;}
  }
  const decorated=(id,version,found)=>({...found,metadata:archivedMetadata(id,version,found)});
  // On-demand successful lookups can be retained indefinitely, within a cap.
  const persistDownloads = process.env.ASSET_PERSIST_DOWNLOADS !== '0';
  const archiveMaxBytes = Math.max(0,Math.min(1000,Number(process.env.ASSET_ARCHIVE_MAX_GB || 20))) * 1024 ** 3;
  let archiveBytes = 0;
  try {
    for(const name of fs.readdirSync(seedDir)) {
      const p=path.join(seedDir,name);
      if(fs.statSync(p).isFile())archiveBytes += fs.statSync(p).size;
    }
  } catch {}
  const roots = [
    // Permanently seeded, exact-ID archive is always preferred over mutable cache.
    {dir:path.join(serverDir,'native','asset-seed'), prefix:''},
    {dir:path.join(serverDir,'native','asset-library'), prefix:''},
    {dir:path.join(siteDir,'data','scenes','assets'), prefix:'assets_'},
    {dir:path.join(serverDir,'native','asset-recovery','scripts'), prefix:''},
    ...(process.env.AYA_ASSETS_DIR ? [{dir:path.resolve(process.env.AYA_ASSETS_DIR),prefix:''}] : []),
    {dir:cacheDir, prefix:''},
  ];
  const missing = new Map();
  const upstreamMissing = new Map();
  // Store a bounded, short-lived reason so 401s are not silently misreported as missing files.
  const failureReasons = new Map();
  const debug = process.env.ASSET_DEBUG === '1';
  const pending = new Map();
  const waiters = [];
  let active = 0;
  const acquire = () => active < MAX_CONCURRENT
    ? (active++, Promise.resolve(release))
    : waiters.length < MAX_WAITING ? new Promise(resolve => waiters.push(resolve)) : Promise.resolve(null);
  function release() { const next = waiters.shift(); if (next) next(release); else active--; }
  const cacheMax = Math.max(MAX_DOWNLOAD, Math.min(8 * 1024 ** 3, Number(process.env.ASSET_CACHE_MAX_MB || 1024) * 1024 ** 2 || 1024 ** 3));
  function lookup(id,{version=null}={}) {
    if (!validId(id)||!validAssetVersion(version)) return null;
    if(version!==null) {
      for(const directory of [seedDir,cacheDir]) for(const extension of ['',...extensions.filter(Boolean)]) {
        const found=safeFile(directory,assetKey(id,version)+extension);
        if(found) {
          const metadata=archivedMetadata(id,version,found);
          if(metadata?.assetVersionNumber===Number(version) && metadata.versionVerified)
            return {...found,ext:detectExtension(found.file),metadata};
        }
      }
      const latest=lookup(id);
      return latest?.metadata?.assetVersionNumber===Number(version) && latest.metadata.versionVerified?latest:null;
    }
    // Newly seeded files must become visible immediately, even when this ID
    // previously had a short-lived negative lookup entry.
    for(const ext of extensions) {
      const seed=safeFile(seedDir,id+ext);
      if(seed) { missing.delete(id); return decorated(id,null,{...seed,ext:ext||detectExtension(seed.file)}); }
    }
    const expiration = missing.get(id);
    if (expiration && expiration > Date.now()) return null;
    if (expiration) missing.delete(id);
    for (const {dir,prefix} of roots) for (const ext of extensions) {
      const hit = safeFile(dir, prefix + id + ext);
      if (hit) { missing.delete(id); return decorated(id,null,{...hit, ext: ext || detectExtension(hit.file)}); }
    }
    // Dodge the Teapots of Doom uses a 2007 shareddata mesh ID that is no
    // longer in the numeric asset library. The project already archives the
    // classic teapot mesh, so serve that exact local resource as a fallback.
    if (id === '1029523') {
      const teapot = safeFile(path.join(siteDir, 'native-legacy-assets', 'fonts'), 'teapot.mesh');
      if (teapot) { missing.delete(id); return {...teapot,ext:'.mesh'}; }
    }
    // FIFO cache: bounds filesystem work for broken references without locking
    // out newly imported assets indefinitely.
    if (missing.size >= MISS_LIMIT) missing.delete(missing.keys().next().value);
    missing.set(id, Date.now() + MISS_TTL);
    return null;
  }
  async function resolve(id,{version=null}={}) {
    if (!validId(id)||!validAssetVersion(version)) return null;
    const key=assetKey(id,version),options={version};
    const local = lookup(id,options);
    if (local) return local;
    if ((upstreamMissing.get(key) || 0) > clock()) return null;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const done = await acquire();
      if (!done) return null;
      try {
        const cached = lookup(id,options);
        if (cached) return cached;
        const aya = upstreamURL(process.env.AYA_ASSET_FALLBACK_URL, id);
        let bytes = null,metadata=null;
        const failures = [];
        const note = (source, reason) => failures.push(source + ':' + reason);
        let retryDelay=Infinity;
        if (aya && version===null) {
          try {
            const accessKey = process.env.AYA_ASSET_FALLBACK_ACCESS_KEY;
            const delay=beforeRequest(aya);
            if(delay>0){note('aya','upstream_rate_limited');retryDelay=Math.min(retryDelay,delay);}
            else bytes = await downloadBytes(aya, {fetchImpl,report: reason => note('aya',reason),
              onResponse:response=>{if(response.status===429){const wait=retryAfterMs(response.headers);onRateLimit(aya.hostname,wait);retryDelay=Math.min(retryDelay,wait);}},
              headers:accessKey ? {accesskey:accessKey} : {}});
            if(bytes)metadata={provider:'aya',assetId:id,requestedVersion:null,assetVersionNumber:null,assetTypeId:null,identityVerified:false,versionVerified:false};
          }
          catch (error) { note('aya','network_error'); if (debug) console.warn('[2x2 assets] Aya lookup failed for', id, error.message); }
        }
        // Keep scoped Open Cloud coverage; an opt-in preference may try public
        // v1 first. No Roblox session cookies or keys are sent to legacy/CDN URLs.
        const publicEnabled=process.env.ROBLOX_ASSET_FETCH!=='0';
        const providers=process.env.ROBLOX_ASSET_DELIVERY_PREFERENCE==='legacy_v1'
          ? ['legacy_v1_location','opencloud','legacy_v1_bytes']:['opencloud','legacy_v1_location','legacy_v1_bytes'];
        for(const provider of providers) {
          if(bytes)break;
          if(provider==='opencloud'?!process.env.ROBLOX_OPEN_CLOUD_API_KEY:!publicEnabled)continue;
          const params={version,fetchImpl,beforeRequest,onRateLimit,sharedTransfers,lookupVersion:meta=>lookup(id,{version:meta.assetVersionNumber})};
          const result=provider==='opencloud'?await fetchRobloxOpenCloudAsset(id,params):await fetchRobloxLegacyAsset(id,{...params,endpoint:provider==='legacy_v1_bytes'?'bytes':'location'});
          if(result.bytes||result.cached){bytes=result.bytes||fs.readFileSync(result.cached.file);metadata=result.metadata;if(result.cached)metadata.reusedArchivedVersion=true;}
          else {note(provider,result.reason);if(result.reason==='upstream_rate_limited')retryDelay=Math.min(retryDelay,result.retryAfterMs??60000);}
        }
        if (!bytes) {
          const reason = failures.some(x => /HTTP_429|upstream_rate_limited/.test(x)) ? 'upstream_rate_limited' :
            failures.some(x => /HTTP_401|HTTP_403|upstream_auth_required/.test(x)) ? 'upstream_auth_required' :
            failures.some(x => /HTTP_404|upstream_not_found/.test(x)) ? 'upstream_not_found' :
            failures.length ? 'upstream_failed' : 'no_upstream_configured';
          if (failureReasons.size >= MISS_LIMIT) failureReasons.delete(failureReasons.keys().next().value);
          failureReasons.set(key, {reason, details: failures.join(', ')});
          if (debug || reason === 'upstream_auth_required')
            console.warn('[2x2 assets] Unresolved', id, reason, failures.join(', '));
          if (upstreamMissing.size >= MISS_LIMIT) upstreamMissing.delete(upstreamMissing.keys().next().value);
          upstreamMissing.set(key, clock() + (reason==='upstream_rate_limited'?Math.max(1000,retryDelay):UPSTREAM_MISS_TTL));
          return null;
        }
        fs.mkdirSync(cacheDir, {recursive:true});
        const final = path.join(cacheDir, key);
        if(!publishImmutable(final,bytes)){note('cache','archive_conflict');return lookup(id,options);}
        missing.delete(id);
        upstreamMissing.delete(key);
        failureReasons.delete(key);
        // Persistent best-effort archive, separate from the evictable cache.
        // Store original bytes under the numeric ID; never overwrite an
        // existing seed and never allow archiving to break asset delivery.
        if (persistDownloads && archiveBytes + bytes.length <= archiveMaxBytes) {
          try {
            fs.mkdirSync(seedDir,{recursive:true});
            const destination=path.join(seedDir,key);
            if(version!==null || !extensions.some(ext => ext && fs.existsSync(path.join(seedDir,id+ext)))) {
              const existed=fs.existsSync(destination);
              if(!publishImmutable(destination,bytes))throw Error('Archive identity conflict; preserved existing bytes');
              if(!existed)archiveBytes += bytes.length;
            }
          } catch(error) {
            if(error.code !== 'EEXIST')
              console.warn('[2x2 assets] Could not persist asset',id,error.message);
          }
        }
        const record={schemaVersion:1,...metadata,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,fetchedAt:new Date().toISOString()};
        const info=path.join(metadataDir,key+'.json'),temporary=info+'.'+crypto.randomUUID()+'.tmp';
        try{fs.mkdirSync(metadataDir,{recursive:true});fs.writeFileSync(temporary,JSON.stringify(record,null,2)+'\n',{flag:'wx'});fs.renameSync(temporary,info);}
        catch{console.warn('[2x2 assets] Could not persist identity metadata for',key);}
        finally{try{fs.unlinkSync(temporary);}catch{}}
        trimCache(cacheDir, cacheMax, final);
        console.log('[2x2 assets] Cached upstream asset', id, bytes.length, 'bytes');
        return lookup(id,options)||{file:final,size:bytes.length,ext:detectExtension(final),metadata:record};
      } finally { done(); }
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }
  function getRetryAfter(id,{version=null}={}) {
    const key=assetKey(String(id),version);
    return failureReasons.get(key)?.reason==='upstream_rate_limited'?Math.max(0,(upstreamMissing.get(key)||0)-clock()):0;
  }
  function handle(req, res, url) {
    if (!['/api/asset', '/asset', '/asset/'].includes(url.pathname)) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, {'Allow':'GET, HEAD'}).end(); return true;
    }
    const id = url.searchParams.get('id');
    const version=url.searchParams.get('version');
    if (!validId(id)||!validAssetVersion(version)) {
      res.writeHead(400, {'Content-Type':'application/json','Cache-Control':'no-store'})
        .end(JSON.stringify({error:'Invalid asset ID or version.'}));
      return true;
    }
    void resolve(id,{version}).then(found => {
    if (!found) {
      const failure = failureReasons.get(assetKey(id,version));
      const limited=failure?.reason==='upstream_rate_limited';
      res.writeHead(limited?429:404, {'Content-Type':'application/json','Cache-Control':'no-store',
        ...(limited?{'Retry-After':String(Math.max(1,Math.ceil(getRetryAfter(id,{version})/1000)))}:{}),
        'X-2x2-Asset-Reason':failure?.reason || 'not_in_archive'})
        .end(JSON.stringify({error:'Asset could not be resolved.',id,
          reason:failure?.reason || 'not_in_archive',
          expectedDirectory:'server/native/asset-library',supportedExtensions:extensions}));
      return true;
    }
    // Confirm files still exist after lookup (e.g. when imports are replaced).
    let text = null;
    if (publicOrigin) {
      try {
        const original = xmlText(found.file, found.ext, found.size);
        if (original !== null) text = rewriteLegacyAssetUrls(original, publicOrigin);
      } catch { /* Fall back to the original asset stream. */ }
    }
    const data = text === null ? null : Buffer.from(text, 'utf8');
    res.writeHead(200, {'Content-Type': data ? 'application/xml; charset=utf-8' : types[found.ext],
      'Content-Length': data ? data.length : found.size,
      'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'});
    if (req.method === 'HEAD') res.end();
    else if (data) res.end(data);
    else fs.createReadStream(found.file).on('error', () => res.destroy()).pipe(res);
    }).catch(error => {
      console.error('[2x2 assets] Asset retrieval failed:', error.message);
      if (!res.headersSent) res.writeHead(502, {'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:'Asset retrieval failed.'}));
      else res.destroy();
    });
    return true;
  }
  return {lookup,resolve,handle,getRetryAfter, getFailureReason:(id,{version=null}={})=>failureReasons.get(assetKey(String(id),version))?.reason || null};
}
