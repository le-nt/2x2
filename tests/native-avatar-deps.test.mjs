import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectAvatarDependencies} from '../server/lib/native-avatar-deps.mjs';

test('recovers nested model dependencies, deduplicates and reports missing',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-av-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const dir of ['hats','faces','textures'])fs.mkdirSync(path.join(root,dir));
 fs.writeFileSync(path.join(root,'hats','Hat.rbxm'),'<roblox><url>rbxasset://shareddata/charcustom/textures/Tex.png</url><url>rbxasset://shareddata/charcustom/faces/Face.rbxm</url><url>rbxasset://shareddata/charcustom/textures/Missing.png</url></roblox>');
 fs.writeFileSync(path.join(root,'faces','Face.rbxm'),'<roblox><url>rbxasset://shareddata/charcustom/textures/Tex.png</url></roblox>');
 fs.writeFileSync(path.join(root,'textures','Tex.png'),Buffer.from([137,80,78,71]));
 const result=inspectAvatarDependencies(root,{hats:['Hat.rbxm'],face:'Face.rbxm'});
 assert.deepEqual(result.files,['hats/Hat.rbxm','textures/Tex.png','faces/Face.rbxm']);
 assert.deepEqual(result.missing,['textures/Missing.png']);
});
test('rejects traversal and unsafe suffixes while retaining binary models',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-av-safe-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'hats'));
 fs.writeFileSync(path.join(root,'hats','Binary.rbxm'),Buffer.from([0,255,1,2,3]));
 const result=inspectAvatarDependencies(root,{hats:['Binary.rbxm','../../secret.rbxm','Bad.exe']});
 assert.deepEqual(result.files,['hats/Binary.rbxm']);
 assert.deepEqual(result.missing,['hats/../../secret.rbxm','hats/Bad.exe']);
});
test('does not traverse symlinks outside charcustom',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-av-symlink-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'hats'));
 const outside=path.join(os.tmpdir(),'2x2-av-outside-'+process.pid+'.png');
 fs.writeFileSync(outside,'outside');
 t.after(()=>fs.rmSync(outside,{force:true}));
 try{fs.symlinkSync(outside,path.join(root,'hats','Outside.png'));}
 catch(error){if(process.platform==='win32'&&error.code==='EPERM'){t.skip('Symlink privilege unavailable');return;}throw error;}
 assert.deepEqual(inspectAvatarDependencies(root,{hats:['Outside.png']}).files,[]);
});
