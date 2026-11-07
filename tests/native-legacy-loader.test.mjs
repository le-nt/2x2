import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sandbox={Uint8Array,URL,encodeURIComponent};sandbox.window=sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root,'site/js/native-legacy-loader.js'),'utf8'),sandbox);
const loader=sandbox.NativeLegacyAssets;
test('validates asset manifest path traversal',()=>{
 assert.equal(loader.isSafe('textures/Tool.png'),true);
 for(const bad of ['../secret','textures/../secret','textures//abc','textures/../../foo','textures/a\\b','/textures/a'])
  assert.equal(loader.isSafe(bad),false,bad);
});
test('downloads other assets when one optional file is absent',async()=>{
 const fetcher=async url=>{
  if(url.endsWith('manifest.json'))return {ok:true,json:async()=>['fonts/sword.mesh','sounds/missing.wav']};
  if(url.endsWith('sword.mesh'))return {ok:true,status:200,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
  return {ok:false,status:404};
 };
 const result=await loader.download(fetcher);
 assert.equal(result.files.length,1);assert.deepEqual(Array.from(result.missing),['sounds/missing.wav']);
});
test('fails visibly for server errors instead of silently dropping assets',async()=>{
 const fetcher=async url=>url.endsWith('manifest.json')?{ok:true,json:async()=>['textures/foo.png']}:{ok:false,status:500};
 await assert.rejects(loader.download(fetcher),/HTTP 500/);
});
test('installs assets and case aliases without overwriting existing files',()=>{
 const paths=new Map([['/content/textures/existing.png',new Uint8Array([9])]]);
 const dirs=new Set(['/','/content','/content/textures']);
 const fsMock={
  analyzePath:p=>({exists:paths.has(p)||dirs.has(p)}),
  mkdirTree(p){let cur='';for(const x of p.split('/').filter(Boolean)){cur+='/'+x;dirs.add(cur);}},
  writeFile:(p,b)=>paths.set(p,new Uint8Array(b)),
  readdir(p){return ['.','..',...new Set([...dirs,...paths.keys()].filter(x=>x.startsWith(p+'/')).map(x=>x.slice(p.length+1).split('/')[0]))];},
  stat:p=>({mode:dirs.has(p)?1:2}),isDir:mode=>mode===1,readFile:p=>paths.get(p)
 };
 loader.install(fsMock,{files:[['textures/existing.png',new Uint8Array([1])],['textures/new.png',new Uint8Array([2])],['fonts/sword.mesh',new Uint8Array([3])]]});
 assert.equal(paths.get('/content/textures/existing.png')[0],9);
 assert.equal(paths.get('/content/Textures/new.png')[0],2);
 assert.equal(paths.get('/content/Fonts/sword.mesh')[0],3);
});
test('accepts wrapped manifest with files array',async()=>{
 const fetcher=async url=>url.endsWith('manifest.json')?{ok:true,json:async()=>({files:['textures/a.png']})}:{ok:true,status:200,arrayBuffer:async()=>new Uint8Array([2]).buffer};
 const result=await loader.download(fetcher);
 assert.equal(result.files.length,1);
 assert.equal(result.expected,1);
});
test('explains malformed manifest response shape',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>({error:'not found'})});
 await assert.rejects(loader.download(fetcher),/got object/);
});
test('client skips optional preload errors before native startup',()=>{
 const source=fs.readFileSync(path.join(root,'site/js/native-test.js'),'utf8');
 assert.match(source,/Optional preload skipped/);
 assert.match(source,/console\.warn\('\[legacy assets\] Optional preload skipped:'/);
 assert.match(source,/window\.Module\s*=\s*\{/);
});
