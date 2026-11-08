#!/usr/bin/env node
/**
 * Audit referenced numeric Roblox assets in imported native map files.
 * Dry run by default. Use --download to populate the existing content cache
 * through createAssetResolver's bounded AyaEX / Roblox sources.
 *
 * This scans XML maps. Binary RBXL files and embedded/obfuscated references
 * require a proper parser and are explicitly reported as unscanned.
 */
import fs from 'node:fs';
import path from 'node:path';
import {StringDecoder} from 'node:string_decoder';
import {fileURLToPath} from 'node:url';
import {createAssetResolver} from '../server/lib/asset-resolver.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');
const siteDir = path.join(root, 'site');
const nativeDir = path.join(serverDir, 'native');
const indexFile = path.join(nativeDir, 'places.json');
const outputFile = path.join(nativeDir, 'asset-audit.json');
const args = process.argv.slice(2);
const download = args.includes('--download');
const json = args.includes('--json');
const opts = args.filter(x => x.startsWith('--')).filter(x => !['--download','--json'].includes(x));
if (opts.length) throw Error('Unknown flags: ' + opts.join(', '));
const index = JSON.parse(fs.readFileSync(indexFile, 'utf8')).places;
const resolver = createAssetResolver({serverDir, siteDir});

const patterns = [
  /rbxassetid:\/\/([1-9][0-9]{0,15})/gi,
  /https?:\/\/(?:www\.)?roblox\.com\/asset\/?\?[^"'<\s]*?\bid=([1-9][0-9]{0,15})/gi,
  /https?:\/\/assetdelivery\.roblox\.com\/v[12]\/asset\/?\?[^"'<\s]*?\bid=([1-9][0-9]{0,15})/gi,
  /(?:h?rbxasset:\/\/)(?:\.\.\/|\.\/)*shareddata\/assets\/([1-9][0-9]{0,15})/gi,
];
const references = new Map(), errors = [], unscanned = [];
function collect(text, placeId) {
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const id = m[1];
      if (!Number.isSafeInteger(Number(id))) continue;
      if (!references.has(id)) references.set(id, new Set());
      references.get(id).add(placeId);
    }
  }
}
async function scan(file, placeId) {
  const header = Buffer.alloc(256);
  const fd = fs.openSync(file, 'r');
  let count;
  try { count = fs.readSync(fd, header, 0, header.length, 0); }
  finally { fs.closeSync(fd); }
  const opening = header.subarray(0, count).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (!opening.startsWith('<roblox') && !opening.startsWith('<?xml')) {
    unscanned.push({placeId, reason:'binary_or_unknown_format'});
    return;
  }
  const decoder = new StringDecoder('utf8');
  let tail = '';
  const stream = fs.createReadStream(file, {highWaterMark:256 * 1024});
  for await (const chunk of stream) {
    const text = tail + decoder.write(chunk);
    collect(text, placeId);
    tail = text.slice(-512);
  }
  collect(tail + decoder.end(), placeId);
}

const mapRoot = path.join(nativeDir, 'maps');
const resolvedRoot = fs.realpathSync(mapRoot);
for (const [placeId, entry] of Object.entries(index)) {
  if (typeof entry.file !== 'string') { errors.push({placeId,error:'invalid_manifest_path'}); continue; }
  try {
    const file = fs.realpathSync(path.join(mapRoot, entry.file));
    if (!file.startsWith(resolvedRoot + path.sep)) {
      errors.push({placeId,error:'outside_map_root'});continue;
    }
    if (!fs.statSync(file).isFile()) continue;
    await scan(file, placeId);
  } catch (error) {
    errors.push({placeId,error:error.code || error.message});
  }
}

const all = [...references.entries()].sort((a,b)=>Number(a[0])-Number(b[0]));
const records = all.map(([id,places])=>({id,places:[...places].sort(),status:resolver.lookup(id) ? 'local' : 'missing'}));
const initiallyMissing = records.filter(x => x.status === 'missing');
if (download) {
  // Keep the queue small. Resolver itself imposes rate / timeout / size limits.
  const concurrency = Math.min(4, initiallyMissing.length);
  let cursor=0;
  const workers = Array.from({length:concurrency},async()=>{
    while (cursor < initiallyMissing.length) {
      const record = initiallyMissing[cursor++];
      try {
        const found = await resolver.resolve(record.id);
        record.status = found ? 'downloaded' : 'unresolved';
        if (!found) record.reason = resolver.getFailureReason(record.id) || 'not_available';
      } catch (error) {
        record.status = 'error';
        record.reason = error.code || error.message;
      }
    }
  });
  await Promise.all(workers);
}
const counts = Object.fromEntries(
  ['local','missing','downloaded','unresolved','error'].map(status=>[status,records.filter(x=>x.status===status).length])
);
const result={
  generatedAt:new Date().toISOString(),
  mode:download?'download':'audit',
  source:'imported XML native maps',
  referencedAssetCount:records.length,
  counts,
  unscanned,
  errors,
  assets:records
};
fs.writeFileSync(outputFile, JSON.stringify(result,null,2)+'\n');
if (!json) {
  console.log('Scanned maps:',Object.keys(index).length);
  console.log('Distinct numeric references:',records.length);
  console.log('Coverage:',JSON.stringify(counts));
  console.log('Unscanned binary/unknown maps:',unscanned.length);
  console.log('Map read errors:',errors.length);
  console.log('Report:',outputFile);
} else {
  console.log(JSON.stringify({referencedAssetCount:records.length,counts,unscanned:unscanned.length,errors:errors.length,report:outputFile}));
}
