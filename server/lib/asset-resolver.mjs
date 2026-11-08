// Offline Roblox asset resolver. AyaEX-inspired local-first lookup, bounded
// negative cache, and XML-only URL substitution. Bounded on-demand upstream fallback.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
async function downloadBytes(startURL, {roblox = false, report = () => {}, headers = {}} = {}) {
  let url = new URL(startURL);
  const abort = AbortSignal.timeout(12000);
  for (let redirects = 0; redirects < 4; redirects++) {
    if (roblox && !trustedRobloxRedirect(url)) { report('untrusted_redirect'); return null; }
    const response = await fetch(url, {redirect:'manual', signal:abort, headers});
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
      .filter(name => /^[1-9]\d{0,15}$/.test(name))
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
function safeFile(base, name) {
  try {
    const root = fs.realpathSync(base);
    const candidate = fs.realpathSync(path.join(root, name));
    if (!candidate.startsWith(root + path.sep)) return null;
    const stat = fs.statSync(candidate);
    if (!stat.isFile() || stat.size > MAX_FILE) return null;
    return {file:candidate, size:stat.size};
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
  const target = id => origin + (origin.endsWith('/native') ? '/asset?id=' : '/api/asset?id=') + id;
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
  if (/^\s*(?:<\?xml[^>]*>\s*)?<roblox(?:\s|>)/i.test(b.toString('utf8'))) return '.rbxmx';
  return '.rbxm';
}

export function createAssetResolver({serverDir, siteDir, publicOrigin = ''}) {
  const cacheDir = path.join(serverDir, 'native', 'asset-cache');
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
  function lookup(id) {
    if (!validId(id)) return null;
    const expiration = missing.get(id);
    if (expiration && expiration > Date.now()) return null;
    if (expiration) missing.delete(id);
    for (const {dir,prefix} of roots) for (const ext of extensions) {
      const hit = safeFile(dir, prefix + id + ext);
      if (hit) { missing.delete(id); return {...hit, ext: ext || detectExtension(hit.file)}; }
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
  async function resolve(id) {
    if (!validId(id)) return null;
    const local = lookup(id);
    if (local) return local;
    if ((upstreamMissing.get(id) || 0) > Date.now()) return null;
    if (pending.has(id)) return pending.get(id);
    const task = (async () => {
      const done = await acquire();
      if (!done) return null;
      try {
        const cached = lookup(id);
        if (cached) return cached;
        const aya = upstreamURL(process.env.AYA_ASSET_FALLBACK_URL, id);
        let bytes = null;
        const failures = [];
        const note = (source, reason) => failures.push(source + ':' + reason);
        if (aya) {
          try {
            const accessKey = process.env.AYA_ASSET_FALLBACK_ACCESS_KEY;
            bytes = await downloadBytes(aya, {report: reason => note('aya',reason),
              headers:accessKey ? {accesskey:accessKey} : {}});
          }
          catch (error) { note('aya','network_error'); if (debug) console.warn('[2x2 assets] Aya lookup failed for', id, error.message); }
        }
        if (!bytes && process.env.ROBLOX_ASSET_FETCH !== '0') {
          try { bytes = await downloadBytes('https://assetdelivery.roblox.com/v1/asset/?id=' + id, {roblox:true,report:reason=>note('roblox',reason)}); }
          catch (error) { note('roblox','network_error'); if (debug) console.warn('[2x2 assets] Roblox lookup failed for', id, error.message); }
        }
        if (!bytes) {
          const reason = failures.some(x => /HTTP_401|HTTP_403/.test(x)) ? 'upstream_auth_required' :
            failures.some(x => /HTTP_404/.test(x)) ? 'upstream_not_found' :
            failures.length ? 'upstream_failed' : 'no_upstream_configured';
          if (failureReasons.size >= MISS_LIMIT) failureReasons.delete(failureReasons.keys().next().value);
          failureReasons.set(id, {reason, details: failures.join(', ')});
          if (debug || reason === 'upstream_auth_required')
            console.warn('[2x2 assets] Unresolved', id, reason, failures.join(', '));
          if (upstreamMissing.size >= MISS_LIMIT) upstreamMissing.delete(upstreamMissing.keys().next().value);
          upstreamMissing.set(id, Date.now() + UPSTREAM_MISS_TTL);
          return null;
        }
        fs.mkdirSync(cacheDir, {recursive:true});
        const final = path.join(cacheDir, id);
        const temporary = path.join(cacheDir, '.' + id + '-' + crypto.randomUUID() + '.tmp');
        try {
          fs.writeFileSync(temporary, bytes, {flag:'wx'});
          fs.renameSync(temporary, final);
        } finally { try { fs.unlinkSync(temporary); } catch {} }
        missing.delete(id);
        upstreamMissing.delete(id);
        failureReasons.delete(id);
        trimCache(cacheDir, cacheMax, final);
        console.log('[2x2 assets] Cached upstream asset', id, bytes.length, 'bytes');
        return lookup(id);
      } finally { done(); }
    })();
    pending.set(id, task);
    try { return await task; } finally { pending.delete(id); }
  }
  function handle(req, res, url) {
    if (!['/api/asset', '/asset', '/asset/'].includes(url.pathname)) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, {'Allow':'GET, HEAD'}).end(); return true;
    }
    const id = url.searchParams.get('id');
    if (!validId(id)) {
      res.writeHead(400, {'Content-Type':'application/json','Cache-Control':'no-store'})
        .end(JSON.stringify({error:'Invalid asset ID.'}));
      return true;
    }
    void resolve(id).then(found => {
    if (!found) {
      const failure = failureReasons.get(id);
      res.writeHead(404, {'Content-Type':'application/json','Cache-Control':'no-store',
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
  return {lookup,resolve,handle, getFailureReason: id => failureReasons.get(String(id))?.reason || null};
}
