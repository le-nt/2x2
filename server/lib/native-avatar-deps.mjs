// Resolve native avatar dependencies without escaping the local charcustom directory.
import fs from 'node:fs';
import path from 'node:path';

const MAX_FILES = 512;
const MAX_MODEL_BYTES = 2 * 1024 * 1024;
const ALLOWED = /\.(?:rbxm|rbxmx|png|jpe?g|mesh|dds|wav|mp3|ogg)$/i;
const LOCAL_REF = /<url>\s*h?rbxasset:\/\/[./]*shareddata\/charcustom\/([^<]+?)\s*<\/url>/gi;
const SAFE = /^[A-Za-z0-9_][A-Za-z0-9_ .,'()&+\-]*(?:\/[A-Za-z0-9_ .,'()&+\-]+)*$/;

function validRelative(relative) {
  return typeof relative === 'string' && relative.length < 512 &&
    !relative.includes('..') && SAFE.test(relative) && ALLOWED.test(relative);
}
function containedFile(root, relative) {
  if (!validRelative(relative)) return null;
  try {
    const base = fs.realpathSync(root);
    const file = fs.realpathSync(path.join(base, relative));
    if (!file.startsWith(base + path.sep)) return null;
    const stat = fs.statSync(file);
    return stat.isFile() ? {file, size:stat.size} : null;
  } catch { return null; }
}

/** Collect existing avatar files plus missing references for diagnostics.
 * Missing dependencies never prevent the rest of the avatar from loading.
 */
export function inspectAvatarDependencies(charRoot, avatar, {maxFiles=MAX_FILES}={}) {
  const files=[], missing=[];
  const seen=new Set();
  const root=avatar && typeof avatar==='object' ? avatar : {};
  const chosen=[
    ...(Array.isArray(root.hats) ? root.hats.slice(0,3).map(v=>'hats/'+v) : []),
    ...Object.entries({face:'faces',head:'heads',shirt:'shirts',pants:'pants',tshirt:'tshirts',extra:'custom'})
      .filter(([key])=>typeof root[key]==='string')
      .map(([key,dir])=>dir+'/'+root[key]),
  ];
  function visit(relative,depth) {
    if (seen.size>=maxFiles || seen.has(relative)) return;
    seen.add(relative);
    const hit=containedFile(charRoot,relative);
    if (!hit) { missing.push(relative); return; }
    files.push(relative);
    if (depth>=8 || !/\.rbxmx?$/i.test(relative) || hit.size>MAX_MODEL_BYTES) return;
    // Binary RBXM models are never decoded/re-written as XML.
    const contents=fs.readFileSync(hit.file);
    if (!/^\s*(?:<\?xml[^>]*>\s*)?<roblox(?:\s|>)/i.test(contents.subarray(0,256).toString('utf8'))) return;
    for (const match of contents.toString('utf8').matchAll(LOCAL_REF)) {
      if (seen.size>=maxFiles) break;
      visit(match[1].trim(),depth+1);
    }
  }
  for (const file of chosen) visit(file,0);
  return {files,missing};
}
