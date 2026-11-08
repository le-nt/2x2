#!/usr/bin/env node
// Read-only inventory of explicit archive roots. Hash original bytes; never stage
// files or follow links. All output goes to the configured manifest.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {canonicalResource, VFS_SCHEMA} from '../server/lib/asset-vfs.mjs';

export async function inventoryArchives(roots, {maxFiles=250000, maxBytes=100 * 1024 ** 3} = {}) {
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > 250000 || !Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw Error('Invalid inventory limits');
  const ids = new Set(), files = [], diagnostics = [];
  let visited = 0, hashedBytes = 0, truncated = false;
  for (const root of roots) {
    if (!root.id || ids.has(root.id) || !['content','shareddata'].includes(root.namespace)) throw Error('Invalid or duplicate archive root');
    ids.add(root.id);
    let base;
    try { base = fs.realpathSync(root.path); if (!fs.statSync(base).isDirectory()) throw Error('not_directory'); }
    catch { diagnostics.push({rootId:root.id, reason:'root_unavailable'}); continue; }
    const pending = [''];
    while (pending.length && !truncated) {
      const relative = pending.pop();
      let entries;
      try { entries = await fs.promises.readdir(path.join(base,relative), {withFileTypes:true}); }
      catch { diagnostics.push({rootId:root.id, relativePath:relative, reason:'directory_unreadable'}); continue; }
      entries.sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      for (const entry of entries) {
        if (++visited > maxFiles) { truncated = true; break; }
        const rel = relative ? relative + '/' + entry.name : entry.name;
        if (entry.isSymbolicLink()) { diagnostics.push({rootId:root.id, relativePath:rel, reason:'link_skipped'}); continue; }
        if (entry.isDirectory()) { if (!['.git','node_modules','build'].includes(entry.name)) pending.push(rel); continue; }
        if (!entry.isFile()) continue;
        const ref = canonicalResource((root.namespace === 'shareddata' ? 'shareddata/' : '') + rel);
        if (!ref) continue;
        const file = path.join(base,rel);
        try {
          const before = await fs.promises.stat(file);
          if (before.size > 64*1024*1024) { diagnostics.push({rootId:root.id,relativePath:rel,reason:'file_size_limit'}); continue; }
          if (hashedBytes + before.size > maxBytes) { truncated = true; break; }
          const hash = crypto.createHash('sha256');
          for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
          const after = await fs.promises.stat(file);
          if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw Error('file_changed_during_scan');
          hashedBytes += before.size;
          files.push({rootId:root.id, namespace:root.namespace, relativePath:rel, originalLocation:file,
            size:before.size, fileType:path.extname(rel).slice(1).toLowerCase(), sha256:hash.digest('hex'),
            sourceArchive:root.sourceArchive || root.id, clientVersion:root.clientVersion || null,
            assetId:null, compatibility:'not_tested'});
        } catch { diagnostics.push({rootId:root.id,relativePath:rel,reason:'file_unreadable_or_changed'}); }
      }
    }
    if (truncated) break;
  }
  const keys = new Map();
  for (const entry of files) {
    const key = entry.namespace + '/' + entry.relativePath.toLowerCase();
    if (!keys.has(key)) keys.set(key,[]);
    keys.get(key).push(entry);
  }
  const collisions = [...keys].filter(([,v])=>v.length>1).map(([key,v])=>({key,
    kind:new Set(v.map(e=>e.sha256)).size>1?'conflict':'duplicate',
    files:v.map(e=>({rootId:e.rootId,relativePath:e.relativePath,sha256:e.sha256}))}));
  return {schemaVersion:VFS_SCHEMA, generatedAt:new Date().toISOString(), complete:!truncated && !diagnostics.length,
    truncated, visitedEntries:visited, hashedBytes, roots:roots.map(({id,namespace,clientVersion})=>({id,namespace,clientVersion})),
    files, collisions, diagnostics};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const configFile = process.argv[2];
  if (!configFile || process.argv.length !== 3) throw Error('Usage: node tools/inventory-asset-vfs.mjs CONFIG.json');
  const base = path.dirname(path.resolve(configFile));
  const config = JSON.parse(fs.readFileSync(configFile,'utf8'));
  const result = await inventoryArchives(config.roots.map(r=>({...r,path:path.resolve(base,r.path)})),config.limits);
  const output = path.resolve(base,config.manifest);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const temp = output + '.' + crypto.randomUUID() + '.tmp';
  try { fs.writeFileSync(temp,JSON.stringify(result,null,2)+'\n',{flag:'wx'}); fs.renameSync(temp,output); }
  finally { try {fs.unlinkSync(temp);} catch {} }
  console.log(JSON.stringify({manifest:output,files:result.files.length,collisions:result.collisions.length,diagnostics:result.diagnostics.length,truncated:result.truncated}));
}
