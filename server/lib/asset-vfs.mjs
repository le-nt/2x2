// Manifest-backed archive mappings. Never infer identity from a basename.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const VFS_SCHEMA = 1;
const MAX_FILE = 64 * 1024 * 1024;
export function canonicalResource(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  // Recognize only the documented historical shareddata escape, before
  // validating segments. Never apply filesystem normalization to '..'.
  let text = value;
  if (/^h?rbxasset:\/\//i.test(text)) text = text.replace(/^h?rbxasset:\/\//i, '');
  text = text.replace(/^(?:\.\.\/)+(?=shareddata\/)/i, '');
  if (/%|[\\\x00-\x1f\x7f?#:]/.test(text) || text.startsWith('/')) return null;
  // Historical content frequently contains repeated internal separators.
  // Collapse only those separators, after rejecting absolute/escaped paths;
  // dot segments remain invalid and never acquire filesystem semantics.
  text = text.replace(/\/{2,}/g, '/');
  const parts = text.split('/');
  if (parts.some(s => !s || s === '.' || s === '..' || /[. ]$/.test(s))) return null;
  let namespace = 'content';
  if (parts[0]?.toLowerCase() === 'shareddata') { namespace = 'shareddata'; parts.shift(); }
  if (!parts.length || !/\.(?:png|jpe?g|dds|mesh|wav|ogg|mp3|rbxm|rbxmx|rbxl|rbxlx|lua|txt|ttf|otf|fnt)$/i.test(parts.at(-1))) return null;
  return {namespace, relativePath: parts.join('/'), key: namespace + '/' + parts.join('/').toLowerCase()};
}
export function safeArchiveFile(root, relativePath) {
  if (typeof relativePath !== 'string' || /[\\\x00-\x1f:]/.test(relativePath) || path.isAbsolute(relativePath) ||
      relativePath.split('/').some(s => !s || s === '.' || s === '..')) return null;
  try {
    const base = fs.realpathSync.native(root), file = fs.realpathSync.native(path.join(base, relativePath));
    const rel = path.relative(base, file);
    if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return null;
    const stat = fs.statSync(file);
    return stat.isFile() && stat.size > 0 && stat.size <= MAX_FILE ? {file, stat} : null;
  } catch { return null; }
}
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// A mount prefix changes only the resource name, never the physical path.
// Keep it in trusted root configuration so a manifest cannot remount itself.
export function archiveVirtualPrefix(root) {
  const prefix = root.virtualPrefix ?? '';
  if (typeof prefix !== 'string' || prefix.length > 1024 ||
      (prefix && (/%|[\\\x00-\x1f\x7f?#:]/.test(prefix) ||
        prefix.split('/').some(s => !s || s === '.' || s === '..' || /[. ]$/.test(s)))))
    throw Error('Invalid Asset VFS virtual prefix');
  return prefix ? prefix + '/' : '';
}

export function archiveResource(root, relativePath) {
  const ref = canonicalResource((root.namespace === 'shareddata' ? 'shareddata/' : '') +
    archiveVirtualPrefix(root) + relativePath);
  return ref?.namespace === root.namespace ? ref : null;
}

export function createAssetVfs({manifest, roots, mappings = [], maxEntries = 250000}) {
  if (manifest?.schemaVersion !== VFS_SCHEMA || !Array.isArray(manifest.files) || manifest.files.length > maxEntries)
    throw Error('Invalid or oversized Asset VFS manifest');
  // roots is trusted server configuration; manifest absolute locations are
  // provenance only, never authority to read a path.
  const configured = new Map(roots.map(r => [r.id, r]));
  if(configured.size!==roots.length)throw Error('Duplicate Asset VFS root IDs');
  for (const root of roots) archiveVirtualPrefix(root);
  if(!Array.isArray(mappings) || mappings.length>4096)throw Error('Invalid Asset VFS mappings');
  const mappedPaths=new Map();
  for(const mapping of mappings) {
    const from=canonicalResource(mapping.from),to=canonicalResource(mapping.to);
    if(!from || !to || from.key===to.key || mappedPaths.has(from.key) ||
        !/^[a-f0-9]{64}$/.test(mapping.sha256) || typeof mapping.reason!=='string' ||
        !mapping.reason.trim() || mapping.reason.length>2048)throw Error('Invalid Asset VFS mapping');
    mappedPaths.set(from.key,{...mapping,from,to});
  }
  const byKey = new Map();
  const verified = new Map();
  for (const entry of manifest.files) {
    if(!['content','shareddata'].includes(entry.namespace))continue;
    const root = configured.get(entry.rootId);
    const ref = root && archiveResource(root, entry.relativePath);
    if (!root || !ref || root.namespace !== entry.namespace || !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        !Number.isSafeInteger(entry.size) || entry.size <= 0 || entry.size > MAX_FILE) continue;
    if (!byKey.has(ref.key)) byKey.set(ref.key, []);
    byKey.get(ref.key).push(entry);
  }
  function resolve(value, {version = null, expectedSha256 = null} = {}) {
    const ref = canonicalResource(value);
    if (!ref) return {status: 'invalid_reference'};
    let entries = byKey.get(ref.key) || [];
    // Only a missing exact path may use an administrator-approved, hash-pinned
    // relocation. Never hide conflicts, damaged bytes or version mismatches.
    const mapping=!entries.length && mappedPaths.get(ref.key);
    if(mapping) {
      if(expectedSha256 && expectedSha256!==mapping.sha256)return {status:'mapping_hash_mismatch',reference:ref};
      entries=(byKey.get(mapping.to.key)||[]).filter(e=>e.sha256===mapping.sha256);
    }
    if (version) entries = entries.filter(e => e.clientVersion === version);
    if (expectedSha256) entries = entries.filter(e => e.sha256 === expectedSha256);
    if (!entries.length) return {status: 'unresolved', reference: ref};
    if (new Set(entries.map(e => e.sha256)).size > 1)
      return {status: 'conflict', reference: ref, candidates: entries.map(e => ({rootId:e.rootId, clientVersion:e.clientVersion, sha256:e.sha256}))};
    let reason = 'unavailable';
    for (const entry of entries) {
      const found = safeArchiveFile(configured.get(entry.rootId).path, entry.relativePath);
      if (!found) continue;
      const fingerprint=[found.stat.size,found.stat.mtimeMs,found.stat.ctimeMs,found.stat.ino,entry.sha256].join(':');
      const cached=verified.get(found.file);
      if (found.stat.size !== entry.size || (!(cached?.fingerprint===fingerprint && cached.until>Date.now()) && sha256(fs.readFileSync(found.file)) !== entry.sha256)) { reason = 'integrity_mismatch'; continue; }
      if(verified.size>=256)verified.delete(verified.keys().next().value);
      verified.set(found.file,{fingerprint,until:Date.now()+15000});
      return {status:'resolved', file:found.file, size:entry.size, sha256:entry.sha256,
        rootId:entry.rootId, clientVersion:entry.clientVersion, reference:ref,
        ...(mapping?{mapping:{target:mapping.to,sha256:mapping.sha256,reason:mapping.reason}}:{})};
    }
    return {status:reason, reference:ref};
  }
  return {resolve};
}

export function loadAssetVfs(configPath = process.env.RBX_ASSET_VFS_CONFIG, projectRoot = null) {
  if(!configPath && projectRoot) {
    const candidate=path.join(projectRoot,'server/native/asset-vfs-config.json');
    if(fs.existsSync(candidate))configPath=candidate;
  }
  if (!configPath) return null;
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const base = path.dirname(path.resolve(configPath));
  const manifestFile = path.resolve(base, config.manifest);
  if (fs.statSync(manifestFile).size > 128 * 1024 * 1024) throw Error('Asset VFS manifest too large');
  return createAssetVfs({manifest:JSON.parse(fs.readFileSync(manifestFile, 'utf8')),
    mappings:config.mappings,
    roots:config.roots.map(r => ({...r, path:path.resolve(base, r.path)}))});
}

// Reload inventories after imports without parsing multi-MiB manifests per
// request. Configuration remains server-owned; clients cannot select roots.
export function createAssetVfsProvider(projectRoot) {
  let current=null, checked=0, fingerprint='',unavailable='vfs_not_configured';
  return {resolve(value,options) {
    if(Date.now()>=checked) {
      checked=Date.now()+1000;
      const configFile=process.env.RBX_ASSET_VFS_CONFIG||path.join(projectRoot,'server/native/asset-vfs-config.json');
      try {
        const configStat=fs.statSync(configFile);
        const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
        const stat=fs.statSync(path.resolve(path.dirname(configFile),config.manifest));
        const next=[configFile,configStat.mtimeMs,configStat.size,stat.mtimeMs,stat.size].join(':');
        if(next!==fingerprint){current=loadAssetVfs(configFile);fingerprint=next;}
      }catch{
        current=null;fingerprint='';
        unavailable=process.env.RBX_ASSET_VFS_CONFIG||fs.existsSync(configFile)?'vfs_configuration_error':'vfs_not_configured';
      }
    }
    return current?.resolve(value,options)||{status:unavailable};
  }};
}
