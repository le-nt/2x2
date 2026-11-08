import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {inventoryArchives} from './inventory-asset-vfs.mjs';
import {loadAssetVfs} from '../server/lib/asset-vfs.mjs';

export function discoverArchiveRoots(projectRoot) {
  const candidates=[];
  const add=(id,namespace,relative,clientVersion=null)=>{
    const directory=path.join(projectRoot,relative);
    try {if(fs.lstatSync(directory).isDirectory())candidates.push({id,namespace,path:directory,clientVersion});}catch{}
  };
  add('engine-content','content','services/engine/.assets/content','UniversalClient-2016');
  add('shareddata','shareddata','clients/shareddata');
  add('project-shareddata','shareddata','shareddata');
  add('legacy-site','shareddata','site/native-legacy-assets');
  try {
    for(const entry of fs.readdirSync(path.join(projectRoot,'clients'),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)))
      if(entry.isDirectory() && entry.name!=='shareddata')add('client-'+entry.name,'content',path.join('clients',entry.name,'content'),entry.name);
  }catch{}
  return candidates;
}
function atomicJson(file,value) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temporary=file+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(temporary,file);}
  finally{try{fs.unlinkSync(temporary);}catch{}}
}
export async function prepareAssetVfs(projectRoot) {
  if(process.env.RBX_ASSET_VFS_CONFIG)return loadAssetVfs();
  const configFile=path.join(projectRoot,'server/native/asset-vfs-config.json');
  if(!fs.existsSync(configFile)) {
    const roots=discoverArchiveRoots(projectRoot);
    fs.mkdirSync(path.dirname(configFile),{recursive:true});
    // First importer wins; never replace administrator configuration.
    try{fs.writeFileSync(configFile,JSON.stringify({schemaVersion:1,autoDiscoverKnownRoots:true,manifest:'asset-vfs-manifest.json',roots},null,2)+'\n',{flag:'wx'});}
    catch(error){if(error.code!=='EEXIST')throw error;}
  }
  const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
  const base=path.dirname(configFile);
  const roots=config.roots.map(r=>({...r,path:path.resolve(base,r.path)}));
  if(config.autoDiscoverKnownRoots) {
    const existing=new Set(roots.map(r=>r.id));
    for(const root of discoverArchiveRoots(projectRoot))if(!existing.has(root.id))roots.push(root);
    // Keep loader configuration synchronized with the inventoried roots.
    if(roots.length!==config.roots.length)atomicJson(configFile,{...config,roots});
  }
  const manifest=await inventoryArchives(roots,config.limits);
  atomicJson(path.resolve(base,config.manifest),manifest);
  return loadAssetVfs(configFile);
}
