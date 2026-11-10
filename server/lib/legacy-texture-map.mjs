// Optional verified mapping for missing legacy rbxasset:// texture filenames.
// An rbxasset path is NOT an asset ID. Never infer an upstream ID from a name.
import fs from 'node:fs';
const NAME = /^[A-Za-z0-9_-]+\.(?:png|jpe?g|dds)$/i;
const ID = /^[1-9][0-9]{0,15}$/;
export function loadLegacyTextureMap(file) {
  if (!fs.existsSync(file)) return new Map();
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Legacy texture mapping must be a JSON object');
  const mapped=new Map();
  for (const [name,id] of Object.entries(data)) {
    if (!NAME.test(name) || typeof id !== 'string' || !ID.test(id) || !Number.isSafeInteger(Number(id)))
      throw Error('Invalid legacy texture filename/asset ID in mapping: '+name);
    mapped.set(name.toLowerCase(),id);
  }
  return mapped;
}
export function legacyTextureAssetId(name, mapping) {
  return typeof name==='string' && NAME.test(name) ? mapping.get(name.toLowerCase()) || null : null;
}
