// Verify the active process, not just files on disk. Never prints a key or cookie.
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{hmac}from'../server/lib/auth.mjs';
const args=process.argv.slice(2),get=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
const root=path.resolve(get('--root')||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
try{
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'server/config.json')));
 const local=`http://localhost:${cfg.port||8090}`;const origin=new URL(get('--url')||cfg.native?.publicOrigin||local).origin;
 const target=new URL(origin);
 if(!['http:','https:'].includes(target.protocol)||(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)&&origin!==cfg.native?.publicOrigin))throw Error('Refusing to send an entrance cookie to an origin outside this project configuration.');
 const response=await fetch(new URL('/api/native/version',origin),{headers:{Cookie:'rbxgate='+hmac(cfg.secret,'gate:'+cfg.accessToken)},redirect:'error',signal:AbortSignal.timeout(5000)});
 if(response.status===404)throw Error('Old server or wrong project is running: /api/native/version returned 404. Close the old Node server and restart node server/server.mjs 8090 from your updated project.');
 if(response.status===401)throw Error('The active server uses a different entrance-key configuration. Verify that you restarted the correct project folder.');
 if(!response.ok)throw Error('Server returned '+response.status);
 const data=await response.json();if(data.version!=='2x2-native-map-pack-v1')throw Error('Native adapter version does not match the installed update.');
 console.log('Correct native server is running. Registered native places:',data.registeredPlaces);
}catch(error){console.error(error.message);process.exitCode=1;}
