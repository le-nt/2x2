// Offline Roblox asset resolver. AyaEX-inspired local-first lookup, bounded
// negative cache, and XML-only URL substitution. No upstream/network fallback.
import fs from 'node:fs';
import path from 'node:path';

const extensions = ['.rbxm', '.rbxmx', '.mesh', '.png', '.jpg', '.jpeg', '.dds', '.wav', '.mp3', '.ogg', '.txt', '.lua', ''];
const types = {'.rbxm':'application/octet-stream','.rbxmx':'application/xml','.mesh':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.dds':'application/octet-stream','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.txt':'text/plain; charset=utf-8','.lua':'text/plain; charset=utf-8'};
const MAX_FILE = 64 * 1024 * 1024;
const MISS_TTL = 15000;
const MISS_LIMIT = 2048;
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
  return xml.replace(/https?:\/\/(?:www\.)?roblox\.com\/asset\/?\?id=([1-9]\d{0,15})(?=[^0-9]|$)/gi,
    (match, id) => validId(id) ? origin + (origin.endsWith('/native') ? '/asset?id=' : '/api/asset?id=') + id : match);
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
  if (/^\\s*(?:<\\?xml[^>]*>\\s*)?<roblox(?:\\s|>)/i.test(b.toString('utf8'))) return '.rbxmx';
  return '.rbxm';
}

export function createAssetResolver({serverDir, siteDir, publicOrigin = ''}) {
  const roots = [
    {dir:path.join(serverDir,'native','asset-library'), prefix:''},
    {dir:path.join(siteDir,'data','scenes','assets'), prefix:'assets_'},
    {dir:path.join(serverDir,'native','asset-recovery','scripts'), prefix:''},
    ...(process.env.AYA_ASSETS_DIR ? [{dir:path.resolve(process.env.AYA_ASSETS_DIR),prefix:''}] : []),
  ];
  const missing = new Map();
  function lookup(id) {
    if (!validId(id)) return null;
    const expiration = missing.get(id);
    if (expiration && expiration > Date.now()) return null;
    if (expiration) missing.delete(id);
    for (const {dir,prefix} of roots) for (const ext of extensions) {
      const hit = safeFile(dir, prefix + id + ext);
      if (hit) { missing.delete(id); return {...hit, ext: ext || detectExtension(hit.file)}; }
    }
    // FIFO cache: bounds filesystem work for broken references without locking
    // out newly imported assets indefinitely.
    if (missing.size >= MISS_LIMIT) missing.delete(missing.keys().next().value);
    missing.set(id, Date.now() + MISS_TTL);
    return null;
  }
  function handle(req, res, url) {
    if (url.pathname !== '/api/asset') return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, {'Allow':'GET, HEAD'}).end(); return true;
    }
    const id = url.searchParams.get('id');
    if (!validId(id)) {
      res.writeHead(400, {'Content-Type':'application/json','Cache-Control':'no-store'})
        .end(JSON.stringify({error:'Invalid asset ID.'}));
      return true;
    }
    const found = lookup(id);
    if (!found) {
      res.writeHead(404, {'Content-Type':'application/json','Cache-Control':'no-store'})
        .end(JSON.stringify({error:'Asset not present in local asset library.',id,
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
    return true;
  }
  return {lookup,handle};
}
