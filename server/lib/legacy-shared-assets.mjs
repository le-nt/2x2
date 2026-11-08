// Resolve exact archive-relative paths from explicitly allowed on-disk roots.
// The historical client used case-insensitive paths; Linux builds do not.
import fs from 'node:fs';
import path from 'node:path';

const allowed = /^(?:[A-Za-z0-9_ -]+\/)*[A-Za-z0-9_ .-]+\.(?:png|jpe?g|dds|mesh|wav|ogg|mp3|rbxm|rbxmx)$/i;
const maxBytes=64*1024*1024;
export function validLegacyPath(rel){
 return typeof rel==='string' && rel.length<=256 && allowed.test(rel) &&
   !rel.includes('..') && !rel.includes('\\') && !rel.startsWith('/') && !rel.includes('\0') &&
   !rel.split('/').some(x=>x==='.'||x==='..'||!x);
}
export function archiveRoots(projectRoot,extra=process.env.RBX_LEGACY_SHARED_ROOTS||''){
 const candidates=[
  path.join(projectRoot,'clients','shareddata'),
  path.join(projectRoot,'shareddata'),
  path.join(projectRoot,'site','native-legacy-assets'),
  path.join(projectRoot,'services','engine','.assets','content'),
  ...extra.split(path.delimiter).filter(Boolean).map(x=>path.resolve(x))
 ];
 const roots=[];const seen=new Set();
 for(const candidate of candidates){
  try{const real=fs.realpathSync(candidate);if(fs.statSync(real).isDirectory()&&!seen.has(real)){roots.push(real);seen.add(real);}}catch{}
 }
 return roots;
}
export function findLegacyArchiveFile(roots,relative){
 if(!validLegacyPath(relative))return null;
 for(const root of roots){
  try{
   // Exact case first, then case-insensitive component matching (historical Windows behavior).
   let current=fs.realpathSync(root);
   for(const segment of relative.split('/')){
    let next=path.join(current,segment);
    if(!fs.existsSync(next)){
     const matches=fs.readdirSync(current).filter(x=>x.toLowerCase()===segment.toLowerCase());
     if(matches.length!==1)throw Error('Missing or ambiguous component');
     next=path.join(current,matches[0]);
    }
    current=fs.realpathSync(next);
    if(current!==root&&!current.startsWith(root+path.sep))throw Error('Symlink outside archive root');
   }
   const stat=fs.statSync(current);
   if(stat.isFile()&&stat.size>0&&stat.size<=maxBytes)return current;
  }catch{}
 }
 return null;
}
