#!/usr/bin/env node
/**
 * Safe, additive import of an existing Novetus shareddata archive.
 * Usage: node tools/seed-novetus-assets.mjs --source "D:\\Novetus\\shareddata"
 * No upstream requests. Existing destination files are never overwritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const flags = process.argv.slice(2);
const index = flags.indexOf('--source');
if (index < 0 || !flags[index+1] || flags.some((v,i)=>v.startsWith('--') && (i!==index || v!=='--source')))
  throw Error('Usage: node tools/seed-novetus-assets.mjs --source "<path to shareddata>"');
let source = fs.realpathSync(flags[index+1]);
if (fs.existsSync(path.join(source,'shareddata')) && fs.statSync(path.join(source,'shareddata')).isDirectory())
  source = fs.realpathSync(path.join(source,'shareddata'));

const targetNumeric = path.join(root,'server/native/asset-library');
const targetTextures = path.join(root,'site/native-legacy-assets/textures');
const targetCharacter = path.join(root,'clients/shareddata/charcustom');
const MAX_FILE = 64 * 1024 * 1024;
const NUMERIC_EXT = new Set(['.mesh','.png','.jpg','.jpeg','.dds','.wav','.ogg','.mp3','.rbxm','.rbxmx','.txt','.lua']);
const IMAGE_EXT = new Set(['.png','.jpg','.jpeg','.dds']);
const CUSTOM_EXT = new Set(['.png','.jpg','.jpeg','.dds','.mesh','.rbxm','.rbxmx']);
const stats={source,created:0,alreadyPresent:0,skipped:0,unsupported:0,tooLarge:0};
const details=[];

function sniffNumeric(file) {
  const fd=fs.openSync(file,'r');
  const head=Buffer.alloc(32);
  let n;
  try{n=fs.readSync(fd,head,0,head.length,0)}finally{fs.closeSync(fd)}
  const b=head.subarray(0,n);
  if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return '.png';
  if(b[0]===255&&b[1]===216&&b[2]===255)return '.jpg';
  if(b.toString('latin1',0,4)==='DDS ')return '.dds';
  if(b.toString('latin1',0,4)==='OggS')return '.ogg';
  if(b.toString('latin1',0,4)==='RIFF' && b.toString('latin1',8,12)==='WAVE')return '.wav';
  if(b.toString('latin1',0,7)==='version')return '.mesh';
  if(b.toString('latin1',0,8)==='<roblox ')return '.rbxmx';
  if(b.toString('latin1',0,5)==='<?xml')return '.rbxmx';
  if(b.toString('latin1',0,8)==='<roblox!')return '.rbxm';
  return null; // refuse to mislabel a mystery binary as an RBXM/mesh
}
function importFile(src, dest) {
  const st=fs.lstatSync(src);
  if(!st.isFile()){stats.skipped++;return}
  if(st.size > MAX_FILE){stats.tooLarge++;return}
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  try {
    fs.copyFileSync(src,dest,fs.constants.COPYFILE_EXCL);
    stats.created++;
  } catch(error) {
    if(error.code==='EEXIST')stats.alreadyPresent++;
    else throw error;
  }
}
function walk(base,fn,depth=0) {
  if(depth>12)throw Error('Archive nesting exceeds limit: '+base);
  for(const entry of fs.readdirSync(base,{withFileTypes:true})){
    const p=path.join(base,entry.name);
    if(entry.isSymbolicLink()){stats.skipped++;continue}
    if(entry.isDirectory())walk(p,fn,depth+1);
    else if(entry.isFile())fn(p,entry.name);
  }
}
function dir(name){const p=path.join(source,name);return fs.existsSync(p)&&fs.statSync(p).isDirectory()?p:null}

for(const folder of ['assets','SBCR']) {
  const directory=dir(folder);
  if(!directory)continue;
  walk(directory,(file,name)=>{
    const match=name.match(/^([1-9][0-9]{0,15})(\.[A-Za-z0-9]+)?$/);
    if(!match||!Number.isSafeInteger(Number(match[1]))){stats.skipped++;return}
    let extension=(match[2]||'').toLowerCase();
    if(!extension)extension=sniffNumeric(file) || '';
    if(!NUMERIC_EXT.has(extension)){stats.unsupported++;details.push({file:path.relative(source,file),reason:'unknown_numeric_format'});return}
    importFile(file,path.join(targetNumeric,match[1]+extension));
  });
}

if(dir('textures')) walk(dir('textures'),(file,name)=>{
  const rel=path.relative(dir('textures'),file);
  // Archive files can be nested, but never import a non-image or a path escape.
  if(rel.split(path.sep).some(p=>p==='..') || !IMAGE_EXT.has(path.extname(name).toLowerCase())){stats.skipped++;return}
  importFile(file,path.join(targetTextures,rel));
});

if(dir('charcustom')) walk(dir('charcustom'),(file,name)=>{
  const rel=path.relative(dir('charcustom'),file);
  if(rel.split(path.sep).some(p=>p==='..') || !CUSTOM_EXT.has(path.extname(name).toLowerCase())){stats.skipped++;return}
  importFile(file,path.join(targetCharacter,rel));
});

const report=path.join(root,'server/native/asset-seed-report.json');
fs.mkdirSync(path.dirname(report),{recursive:true});
fs.writeFileSync(report,JSON.stringify({generatedAt:new Date().toISOString(),stats,details},null,2)+'\n');
console.log('Novetus archive seeded:',JSON.stringify(stats));
console.log('Report:',report);
