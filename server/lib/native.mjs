// Project Pizda protocol adapter using 2x2's existing SQLite identities and catalog.
// No second website, passwords, PostgreSQL account database, or cross-site login handoff.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { pipeline } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { issue,verify,equal,clientTicket,safeRelative } from './native-security.mjs';
import {createNativeChat} from './native-chat.mjs';
import {rewriteLegacyAssetUrls} from './asset-resolver.mjs';
import {inspectAvatarDependencies} from './native-avatar-deps.mjs';
import {loadLegacyTextureMap,legacyTextureAssetId} from './legacy-texture-map.mjs';
import {createNativeAssetPrefetch} from './native-asset-prefetch.mjs';
import {archiveRoots,findLegacyArchiveFile} from './legacy-shared-assets.mjs';
import {createAssetVfsProvider} from './asset-vfs.mjs';

const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const xmlEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function body(req){const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)throw Error('Request too large');parts.push(chunk);}let data=Buffer.concat(parts);if(req.headers['content-encoding']==='gzip')data=gunzipSync(data,{maxOutputLength:65536});else if(req.headers['content-encoding']&&req.headers['content-encoding']!=='identity')throw Error('Unsupported encoding');return data.length?JSON.parse(data.toString('utf8')):{};}
function origin(value){const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.pathname!=='/'||u.username||u.password||u.search||u.hash)throw Error('Use an HTTP(S) publicOrigin without a path.');return u.origin;}
function beneath(root,rel){if(!safeRelative(rel))return null;try{const base=fs.realpathSync(root),file=fs.realpathSync(path.join(base,rel));return file.startsWith(base+path.sep)&&fs.statSync(file).isFile()?file:null;}catch{return null;}}
export function createNative({db,cfg,root,port,sessionUser,isGated,assetResolver}){
 const n=cfg.native;
 const chat=createNativeChat({db,config:n.chat});
 const publicOrigin=origin(n.publicOrigin||`http://localhost:${port}`);
 const base=publicOrigin+'/native';
 const serverDir=path.join(root,'../server');
 const charRoot=path.join(root,'../clients/shareddata/charcustom');
 const legacyTexturesRoot=path.join(root,'native-legacy-assets/textures');
 const engineTexturesRoot=path.join(root,'../services/engine/.assets/content/textures');
 const legacyTextureIds=loadLegacyTextureMap(path.join(serverDir,'native/legacy-texture-ids.json'));
 const sharedRoots=archiveRoots(path.resolve(root,'..'));
 const archiveVfs=createAssetVfsProvider(path.resolve(root,'..'));
 const assetPrefetch=createNativeAssetPrefetch({serverDir,assetResolver});
 const catalogFacesRoot=path.join(root,'img/catalog/faces');
 const mapRoot=path.join(serverDir,'native/maps');
 // Optional on-demand place repair. Original maps and the registry are never modified.
 const preparedMaps=new Map(),prepareAttempted=new Set();
 const execFileAsync=promisify(execFile);
 async function preparePlace(id){
  if(prepareAttempted.has(id))return;
  prepareAttempted.add(id);
  const entry=places.get(id);
  if(!entry||entry.classic.includes('crossroads'))return; // protect proven working Crossroads places
  const projectRoot=path.resolve(serverDir,'..');
  const script=path.join(projectRoot,'tools','prepare-runtime-place.py');
  if(!fs.existsSync(script)||!hasMap(entry))return;
  const python=process.env.RBX_PYTHON||(process.platform==='win32'?'py':'python3');
  try{
   const {stdout}=await execFileAsync(python,[script,'--root',projectRoot,'--place',entry.classic],{cwd:projectRoot,timeout:30000,maxBuffer:1024*1024,windowsHide:true});
   const result=JSON.parse(stdout),counts=result.counts||{};
   if(!counts.repaired_places)return;
   const rel='2x2-runtime-ready/'+entry.classic+'.rbxl';
   const file=beneath(mapRoot,rel);
   if(!file)throw Error('Prepared map missing after script recovery');
   preparedMaps.set(id,file);
   console.log(`[2x2 native] Prepared ${entry.classic}: ${counts.restored_linked_id||0} linked and ${counts.restored_crossroads_template||0} template scripts`);
  }catch(error){console.warn(`[2x2 native] Preparing ${entry.classic} failed; using original map: ${error.message}`);}
 }
 const places=new Map();
 let registryFingerprint='',registryCheck=0;
 function refreshPlaces(){
  if(Date.now()<registryCheck)return;
  registryCheck=Date.now()+1000;
  try {
   const file=path.join(serverDir,'native/places.json'),stat=fs.statSync(file);
   if(stat.size>8*1024*1024)throw Error('Place registry exceeds size limit');
   const fingerprint=stat.mtimeMs+':'+stat.size;
   if(fingerprint===registryFingerprint)return;
   const mapping=JSON.parse(fs.readFileSync(file,'utf8')).places;
   if(!mapping||Array.isArray(mapping)||typeof mapping!=='object')throw Error('Invalid place registry');
   const next=new Map();
   for(const [classic,item] of Object.entries(mapping)){
    if(!/^[a-z0-9-]{1,150}$/.test(classic)||!Number.isSafeInteger(item.id)||item.id<=0||item.id>=2147483647||!safeRelative(item.file))throw Error('Invalid native place entry');
    if(next.has(item.id))throw Error('Duplicate native place ID: '+item.id);
    next.set(item.id,{...item,classic});
   }
   places.clear();for(const [id,item] of next)places.set(id,item);
   registryFingerprint=fingerprint;
  }catch(error){console.warn('[2x2 native] Registry reload failed:',error.message);}
 }
 refreshPlaces();
 db.exec(`CREATE TABLE IF NOT EXISTS native_jobs (job_id TEXT PRIMARY KEY,place_id INTEGER NOT NULL,ready INTEGER NOT NULL DEFAULT 0,last_heartbeat INTEGER NOT NULL,players TEXT NOT NULL DEFAULT '[]',closed INTEGER NOT NULL DEFAULT 0)`);
 // A server restart invalidates transports; do not advertise old jobs as ready.
 db.prepare('UPDATE native_jobs SET closed=1').run();
 const spawning=new Map(),early=new Map(),sockets=new Set();
 async function arbiter(endpoint,payload){
  if(!n.arbiterOrigin)throw Error('Configure native.arbiterOrigin first.');
  const target=new URL(endpoint,origin(n.arbiterOrigin));
  const response=await fetch(target,{method:payload===undefined?'GET':'POST',headers:{AccessKey:n.accessKey,'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw Error('Arbiter returned '+response.status);
  return endpoint==='/health'?response.text():response.json();
 }
 const jobFor=id=>db.prepare('SELECT * FROM native_jobs WHERE place_id=? AND closed=0 AND last_heartbeat>? ORDER BY last_heartbeat DESC LIMIT 1').get(id,Date.now()-100000);
 function startJob(id){
  if(spawning.has(id))return spawning.get(id);
  const task=(async()=>{
   const count=db.prepare('SELECT count(*) AS n FROM native_jobs WHERE closed=0 AND last_heartbeat>?').get(Date.now()-100000).n;
   if(count+spawning.size>=Number(n.maxJobs||4))throw Error('All game workers are busy. Try again shortly.');
   await preparePlace(id);
   // Prefetch only already-discovered missing IDs; never delay game-server startup.
   const classic=places.get(id)?.classic;
   if(classic) assetPrefetch.launch(classic);
   const result=await arbiter('/gameserver/new',{place_id:id});
   if(!result.success||!/^[A-Za-z0-9-]{1,100}$/.test(result.job_id||''))throw Error(result.message||'Game worker creation failed.');
   const heartbeat=early.get(result.job_id);early.delete(result.job_id);
   db.prepare('INSERT INTO native_jobs(job_id,place_id,ready,last_heartbeat,players) VALUES(?,?,?,?,?)').run(result.job_id,id,heartbeat?1:0,Date.now(),JSON.stringify(heartbeat?.userIds||[]));
   // OpenJob may complete after its initial heartbeat; renew once registered.
   await arbiter('/gameserver/renew-lease',{job_id:result.job_id,lease:120});
  })();
  spawning.set(id,task);
  task.catch(error=>{console.error('[2x2 native] '+error.message);failures.set(id,{text:error.message,time:Date.now()});}).finally(()=>spawning.delete(id));
  return task;
 }
 const failures=new Map();
 const maintenance=setInterval(()=>{
  for(const [job,pending]of early)if(Date.now()-pending.time>120000)early.delete(job);
  for(const entry of sockets){const current=sessionUser(entry.cookies);if(!current.user||current.sessionHash!==entry.sid||!isGated(entry.cookies)){entry.socket.destroy();entry.upstream?.destroy();sockets.delete(entry);}}
 },15000);maintenance.unref();
 function hasMap(item){return item&&beneath(mapRoot,item.file);}
 function clientReady(){try{const manifest=JSON.parse(fs.readFileSync(path.join(root,'native-client/manifest.json'),'utf8'));return manifest.format===1&&['UniversalClient.js','UniversalClient.wasm','UniversalClient.data'].every(name=>manifest.files?.[name]&&beneath(path.join(root,'native-client'),manifest.files[name].path));}catch{return false;}}
 function configured(){return !!n.arbiterOrigin&&!!n.accessKey&&!!n.signingKey;}
 function validSession(user,sessionHash,claims){return user&&claims&&claims.uid===user.id&&equal(claims.sid,sessionHash);}
 function appearance(id){const row=db.prepare('SELECT avatar FROM users WHERE id=?').get(id);let avatar={};try{avatar=JSON.parse(row?.avatar||'{}');}catch{}return avatar;}
 function appearanceURL(id){return `${base}/appearance/${id}`;}
 function avatarPaths(av){return inspectAvatarDependencies(charRoot,av).files;}
 function machineAllowed(url){return /^\/native\/(?:archive-content\/?$|legacy-shared\/?$|legacy-texture\/?$|content-asset\/?$|asset\/?$|appearance\/\d+$|bodycolors\/\d+$|content$|api\/game\/players\/[1-9][0-9]{0,15}$|api\/moderation\/filtertext$|internal\/gameserver\/(?:heartbeat|shutdown)$|Game\/LoadPlaceInfo\.ashx)$/.test(url.pathname);}
 function machine(req,url){return machineAllowed(url)&&!!n.accessKey&&equal(req.headers.accesskey,n.accessKey);}
 async function route(req,res,url,user,sessionHash){
  refreshPlaces();
  const p=url.pathname;
  if(p==='/api/native/version')return json(res,200,{version:'2x2-native-map-pack-v1',registeredPlaces:places.size});
  if(p==='/api/native/status'){if(!user)return json(res,401,{error:'Log in first.'});return json(res,200,{engine:'Project Pizda / UniversalClient',clientInstalled:clientReady(),arbiterConfigured:configured(),importedPlaces:[...places.values()].filter(hasMap).length,publicOrigin});}
  if(p==='/api/native/asset-coverage'){
   if(!user)return json(res,401,{error:'Log in first.'});
   const classic=url.searchParams.get('id')||'';
   if(!/^[a-z0-9-]{1,150}$/.test(classic))return json(res,400,{error:'Invalid game ID.'});
   if(![...places.values()].some(entry=>entry.classic===classic))
    return json(res,404,{error:'Unknown game.'});
   const reportFile=path.join(serverDir,'native','asset-reports',classic+'.json');
   try{
    const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));
    return json(res,200,report);
   }catch{return json(res,404,{error:'Asset coverage report unavailable. Run the seeder for this game.'});}
  }
  if(p==='/api/native/launch'){
   if(req.method!=='GET')return json(res,405,{error:'Use GET.'});
   if(!user)return json(res,401,{error:'Log in first.'});
   const entry=[...places.values()].find(m=>m.classic===url.searchParams.get('id'));
   if(!hasMap(entry))return json(res,503,{error:'This place has not been imported. Run tools/import-native.py against the real map files.'});
   if(!clientReady())return json(res,503,{error:'The compiled native WebClient is missing. Install UniversalClient.js, .wasm and .data with tools/install-webclient.py.'});
   if(!configured())return json(res,503,{error:'The native game worker is not configured. Run tools/configure-native.mjs.'});
   return json(res,200,{placeId:entry.id,classicId:entry.classic,manifest:'/native-client/manifest.json',baseUrl:base,joinScriptUrl:`${base}/game/placelauncher?placeId=${entry.id}&requestType=RequestGame`,authenticationUrl:base+'/negotiate'});
  }
  if(!p.startsWith('/native/'))return false;
  const service=machine(req,url);
  if(!service&&!user)return json(res,401,{error:'A current 2x2 session is required.'});
  if(req.method!=='GET'&&req.method!=='HEAD'&&req.method!=='POST')return json(res,405,{error:'Method not supported.'});
  if(await chat(req,res,url,{service,user}))return;
  if(p==='/native/negotiate'){res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});return res.end('OK');}
  if(p==='/native/game/placelauncher'){
   if(req.method!=='POST')return json(res,405,{error:'Use POST.'});
   const id=Number(url.searchParams.get('placeId')),entry=places.get(id);
   if(!hasMap(entry))return json(res,404,{status:3,message:'Place is not imported.'});
   const failed=failures.get(id);if(failed&&Date.now()-failed.time<15000)return json(res,503,{status:3,message:failed.text});
   const job=jobFor(id);
   if(!job){startJob(id);return json(res,200,{status:0,message:'Starting game worker.'});}
   if(!job.ready)return json(res,200,{status:1,message:'Loading place.'});
   if(JSON.parse(job.players).length>=Number(n.maxPlayers||10))return json(res,200,{status:6,message:'The game is full.'});
   const token=issue(n.signingKey,'join',{uid:user.id,sid:sessionHash,job:job.job_id,place:id});
   return json(res,200,{status:2,jobId:job.job_id,authenticationUrl:base+'/negotiate',authenticationTicket:'',joinScriptUrl:base+'/game/join?ticket='+encodeURIComponent(token)});
  }
  if(p==='/native/game/join'){
   const claims=verify(n.signingKey,'join',url.searchParams.get('ticket'));
   if(!validSession(user,sessionHash,claims))return json(res,403,{error:'Invalid or expired game ticket.'});
   const job=db.prepare('SELECT * FROM native_jobs WHERE job_id=? AND closed=0 AND ready=1 AND last_heartbeat>?').get(claims.job,Date.now()-100000);
   if(!job||job.place_id!==claims.place)return json(res,409,{error:'Game worker is no longer available.'});
   const ws=issue(n.signingKey,'socket',{uid:user.id,sid:sessionHash,job:claims.job,place:claims.place});
   const app=appearanceURL(user.id),stamp=new Date().toISOString();
   return json(res,200,{ClientPort:0,WebSocketAddress:publicOrigin.replace(/^http/,'ws')+'/native/ws/'+claims.job+'?ticket='+encodeURIComponent(ws),MachineAddress:'127.0.0.1',ServerPort:53640,PingUrl:'',PingInterval:120,UserName:user.username,UserId:user.id,ClientTicket:clientTicket(n.signingKey,user,claims.job,app,stamp),PlaceId:claims.place,BaseUrl:base,ChatStyle:'ClassicAndBubble',CreatorId:places.get(claims.place)?.creatorId||0,CreatorTypeEnum:'User',MembershipType:'None',AccountAge:Math.max(0,Math.floor((Date.now()-user.created_at)/86400000)),IsRobloxPlace:false,UniverseId:claims.place,GenerateTeleportJoin:false,SessionId:claims.job+'|'+user.id,FollowUserId:0,BrowserTrackerId:0,UsePortraitMode:false,CharacterAppearance:app});
  }
  if(p.startsWith('/native/internal/')){
   if(req.method!=='POST')return json(res,405,{error:'Use POST.'});
   if(!service)return json(res,403,{error:'Worker credentials required.'});
   const payload=await body(req),jobId=payload.jobId;
   if(!/^[A-Za-z0-9-]{1,100}$/.test(jobId||''))return json(res,400,{error:'Invalid jobId.'});
   if(p.endsWith('/shutdown')){db.prepare('UPDATE native_jobs SET closed=1 WHERE job_id=?').run(jobId);arbiter('/gameserver/reported-closed',{job_id:jobId}).catch(()=>{});return json(res,200,{ok:true});}
   const ids=(Array.isArray(payload.userIds)?payload.userIds:[]).filter(v=>Number.isSafeInteger(v)&&v>0).slice(0,100);
   const result=db.prepare('UPDATE native_jobs SET ready=1,last_heartbeat=?,players=? WHERE job_id=? AND closed=0').run(Date.now(),JSON.stringify(ids),jobId);
   if(!result.changes)early.set(jobId,{userIds:ids,time:Date.now()});
   else {const record=db.prepare('SELECT place_id FROM native_jobs WHERE job_id=?').get(jobId);const classic=places.get(record.place_id)?.classic;if(classic)for(const id of ids)db.prepare('UPDATE users SET last_place=?,last_place_at=? WHERE id=?').run(classic,Date.now(),id);arbiter('/gameserver/renew-lease',{job_id:jobId,lease:120}).then(result=>{
 if(!result.success)throw Error(result.message||'Lease renewal rejected');
 console.log('[native lease] renewed',jobId);
}).catch(error=>console.error('[native lease] '+error.message));}
   return json(res,200,{ok:true});
  }
  let file,kind;
  if(/^\/native\/appearance\/\d+$/.test(p)){
   const id=Number(p.split('/').pop());if(!db.prepare('SELECT id FROM users WHERE id=?').get(id))return json(res,404,{error:'Unknown player.'});
   const urls=[`${base}/bodycolors/${id}?version=1`,...avatarPaths(appearance(id)).map(rel=>`${base}/content?path=${encodeURIComponent(rel)}`)];
   res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});return res.end(urls.join(';'));
  }
  if(/^\/native\/bodycolors\/\d+$/.test(p)){
   const av=appearance(Number(p.split('/').pop())),colors=av.colors||{};
   const properties={HeadColor:colors.head??24,TorsoColor:colors.torso??23,LeftArmColor:colors.leftArm??24,RightArmColor:colors.rightArm??24,LeftLegColor:colors.leftLeg??119,RightLegColor:colors.rightLeg??119};
   const data='<roblox version="4"><Item class="BodyColors"><Properties>'+Object.entries(properties).map(([key,value])=>`<int name="${key}">${Number.isInteger(value)&&value>=0&&value<65536?value:24}</int>`).join('')+'</Properties></Item></roblox>';
   res.writeHead(200,{'Content-Type':'application/xml','Cache-Control':'no-store'});return res.end(data);
  }
  if(p==='/native/content'){
   const rel=url.searchParams.get('path');file=beneath(charRoot,rel);
   if(file&&!/\.(rbxm|rbxmx|png|jpe?g|mesh|dds|wav|mp3)$/i.test(file))file=null;
   // A minimal public avatar archive is checked in even if clients/shareddata
   // is absent. Reuse only exact face filenames; do not guess other content.
   if(!file && /^faces\/[A-Za-z0-9_-]+\.(?:png|jpe?g)$/i.test(rel||''))
    file=beneath(catalogFacesRoot,rel.slice('faces/'.length));
   kind=path.extname(file||'');
  }else if(p==='/native/archive-content'){
   const result=archiveVfs?.resolve(url.searchParams.get('path'));
   if(result?.status!=='resolved')return json(res,result?.status==='conflict'?409:404,{error:'Archive resource unavailable.',reason:result?.status||'vfs_not_configured'});
   file=result.file;kind=path.extname(file);
  }else if(p==='/native/legacy-shared'){
   // Local archive paths only; no arbitrary file browsing or network fallback.
   const relative=url.searchParams.get('path');
   const result=archiveVfs?.resolve('shareddata/'+relative);
   if(result && !['resolved','unresolved','vfs_not_configured'].includes(result.status))
    return json(res,result.status==='conflict'?409:404,{error:'Archive resource unavailable.',reason:result.status});
   file=result?.file || findLegacyArchiveFile(sharedRoots,relative);
   kind=path.extname(file||'');
  }else if(p==='/native/legacy-texture'){
   const name=url.searchParams.get('name');
   // Only archive-relative image filenames; path traversal and arbitrary
   // files are not accepted. No unbounded filename-based upstream proxy.
   if(/^[A-Za-z0-9_-]+\.(?:png|jpe?g|dds)$/i.test(name||'')){
    file=beneath(legacyTexturesRoot,name) ||
         beneath(engineTexturesRoot,name);
    if(!file){
     const archived=archiveVfs?.resolve('shareddata/textures/'+name);
     if(archived && !['resolved','unresolved','vfs_not_configured'].includes(archived.status))
      return json(res,archived.status==='conflict'?409:404,{error:'Archive resource unavailable.',reason:archived.status});
     file=archived?.file;
    }
    kind=path.extname(file||'');
    // Only use Cloud when a verified numeric asset ID is explicitly mapped.
    // The local built-in resource always takes precedence.
    if(!file){
     const mapped=legacyTextureAssetId(name,legacyTextureIds);
     if(mapped){const asset=await assetResolver?.resolve(mapped);if(asset){file=asset.file;kind=asset.ext;}}
    }
   }
  }else if(/^\/native\/(?:asset|content-asset)\/?$/.test(p)){
   const assetId=url.searchParams.get('id');
   // Places retain the old /native/asset route; media uses /native/content-asset.
   const isPlaceRoute=/^\/native\/asset\/?$/.test(p);
   const entry=isPlaceRoute&&/^[1-9][0-9]*$/.test(assetId||'')?places.get(Number(assetId)):null;
   file=preparedMaps.get(entry?.id)||hasMap(entry);kind=file?'.rbxl':undefined;
   // Place IDs retain priority; every other numeric ID can resolve to a cached
   // mesh, texture, model, audio file, or exact linked Lua dependency.
   if(!file){const asset=await assetResolver?.resolve(assetId);if(asset){file=asset.file;kind=asset.ext;}}
  }
  else if(p==='/native/Game/LoadPlaceInfo.ashx'){
   const id=Number(url.searchParams.get('PlaceId'));if(!places.has(id))return json(res,404,{error:'Unknown place.'});
   res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});return res.end(`--rbxsig%=0\npcall(function() game:SetPlaceID(${id}, false) end)`);
  }else return json(res,404,{error:'Unknown native endpoint.'});
  if(!file){
   const reason=/^\/native\/(?:asset|content-asset)\/?$/.test(p) ? assetResolver?.getFailureReason(url.searchParams.get('id')) : null;
   return json(res,404,{error:'Native content not found.',reason:reason||'not_in_archive'});
  }
  let data=fs.readFileSync(file);
  const xmlHeader = data.subarray(0,1024).toString('utf8').replace(/^\uFEFF/,'');
  // AyaEX's XML-only asset substitution belongs on the native client endpoint.
  // Never decode/re-encode binary RBXM/RBXL, meshes, images, or audio.
  if (['.rbxm','.rbxmx','.rbxl'].includes(kind) && /^\s*(?:<\?xml[^>]*>\s*)?<roblox(?:\s|>)/i.test(xmlHeader)){
   let xml=data.toString('utf8');
   if(xml.includes('shareddata/charcustom/')){
    xml=xml.replace(/(<url>\s*)h?rbxasset:\/\/[./]*shareddata\/charcustom\/([^<]+?)(\s*<\/url>)/g,
     (_,before,rel,after)=>before+xmlEscape(base+'/content?path='+encodeURIComponent(rel.trim()))+after);
   }
   // Referenced assets must use this authenticated native asset route, not a
   // separate worker-only API or a Roblox domain unavailable to WebAssembly.
   xml=rewriteLegacyAssetUrls(xml,base);
   data=Buffer.from(xml,'utf8');
  }
  const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.dds':'application/octet-stream','.mesh':'application/octet-stream','.rbxm':'application/octet-stream','.rbxl':'application/octet-stream','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.rbxmx':'application/xml','.lua':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
  res.writeHead(200,{'Content-Type':types[kind]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
 }
 function upgrade(req,socket,head,cookies){
  let url;try{url=new URL(req.url,publicOrigin);}catch{socket.destroy();return true;}
  if(!url.pathname.startsWith('/native/ws/'))return false;
  const denied=()=>{socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return true;};
  if(!isGated(cookies)||req.headers.origin!==publicOrigin)return denied();
  const {user,sessionHash}=sessionUser(cookies),claims=verify(n.signingKey,'socket',url.searchParams.get('ticket'));
  if(!validSession(user,sessionHash,claims)||url.pathname!='/native/ws/'+claims.job)return denied();
  if(!db.prepare('SELECT job_id FROM native_jobs WHERE job_id=? AND place_id=? AND closed=0 AND last_heartbeat>?').get(claims.job,claims.place,Date.now()-100000))return denied();
  const target=new URL('/ws/'+claims.job,origin(n.arbiterOrigin));
  const headers={Host:target.host,Connection:'Upgrade',Upgrade:'websocket',AccessKey:n.accessKey,'Sec-WebSocket-Key':req.headers['sec-websocket-key'],'Sec-WebSocket-Version':'13'};
  if(req.headers['sec-websocket-protocol'])headers['Sec-WebSocket-Protocol']=req.headers['sec-websocket-protocol'];
  const upstream=(target.protocol==='https:'?https:http).request(target,{method:'GET',headers,timeout:10000});
  const entry={cookies,sid:sessionHash,socket,upstream:null};sockets.add(entry);
  const cleanup=()=>{sockets.delete(entry);entry.upstream?.destroy();upstream.destroy();};
  socket.on('close',cleanup);socket.on('error',cleanup);
  upstream.on('upgrade',(response,transport,upstreamHead)=>{
   entry.upstream=transport;
   // The 10-second timeout applies only to the upgrade handshake.
   upstream.setTimeout(0);
   transport.setTimeout(0);
   socket.setTimeout(0);
   transport.setNoDelay(true);
   socket.setNoDelay(true);
   transport.setKeepAlive(true,30000);
   socket.setKeepAlive(true,30000);
   console.log('[native ws] Upgraded; handshake timeout disabled');
   const traffic = {fromBrowser:0, fromWorker:0};
   const started = Date.now();
   socket.on('data', chunk => { traffic.fromBrowser += chunk.length; });
   transport.on('data', chunk => { traffic.fromWorker += chunk.length; });
   const trafficTimer = setInterval(() => {
     console.log('[native ws traffic]', JSON.stringify({
       job:claims.job,
       ageSeconds:Math.round((Date.now()-started)/1000),
       ...traffic
     }));
   },5000);
   trafficTimer.unref();
   socket.once('close', () => {
     clearInterval(trafficTimer);
     console.log('[native ws closed]', JSON.stringify({
       job:claims.job,
       ageSeconds:Math.round((Date.now()-started)/1000),
       ...traffic
     }));
   });


   socket.write(`HTTP/1.1 101 Switching Protocols\r\n`+Object.entries(response.headers).filter(([key])=>['connection','upgrade','sec-websocket-accept','sec-websocket-protocol','sec-websocket-extensions'].includes(key)).map(([key,value])=>key+': '+value+'\r\n').join('')+'\r\n');
   if(upstreamHead.length)socket.write(upstreamHead);if(head.length)transport.write(head);
   pipeline(socket,transport,()=>{socket.destroy();cleanup();});pipeline(transport,socket,()=>{socket.destroy();cleanup();});
  });
  upstream.on('response',()=>{socket.destroy();cleanup();});upstream.on('timeout',()=>{socket.destroy();cleanup();});upstream.on('error',()=>{socket.destroy();cleanup();});upstream.end();return true;
 }
 return {machine,route,upgrade,close(){clearInterval(maintenance);for(const entry of sockets){entry.socket.destroy();entry.upstream?.destroy();}}};
}
