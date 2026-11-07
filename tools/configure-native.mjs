// node tools/configure-native.mjs --origin https://2x2.example --arbiter http://127.0.0.1:8081
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from'node:url';import {loadConfig}from'../server/lib/config.mjs';
const args=process.argv.slice(2),value=key=>{const i=args.indexOf(key);return i>=0?args[i+1]:null;};
const root=path.resolve(value('--root')||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
function checked(raw,name){if(!raw)throw Error('Required: '+name);const u=new URL(raw);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error(name+' must be an HTTP(S) origin without a path');return u.origin;}
const publicOrigin=checked(value('--origin'),'--origin'),arbiterOrigin=checked(value('--arbiter'),'--arbiter');
const {cfg,file}=loadConfig(path.join(root,'server'));const n=cfg.native;n.publicOrigin=publicOrigin;n.arbiterOrigin=arbiterOrigin;n.maxJobs=n.maxJobs||4;
fs.writeFileSync(file,JSON.stringify(cfg,null,2)+'\n',{mode:0o600});
const workerFile=path.join(root,'services/arbiter/2x2-config.json');fs.mkdirSync(path.dirname(workerFile),{recursive:true});
fs.writeFileSync(workerFile,JSON.stringify({server:{port:Number(new URL(arbiterOrigin).port||(arbiterOrigin.startsWith('https:')?443:80)),soap_port_range:{start:64000,end:64099},network_server_port_range:{start:65000,end:65099}},access_key:n.accessKey,signing_key:n.signingKey,base_url:publicOrigin+'/native',tls:null},null,2)+'\n',{mode:0o600});
console.log('Configured native launcher and wrote private worker configuration. Existing entrance key and accounts were preserved.');
console.log('Restart 2x2 and run the patched Arbiter with --config services/arbiter/2x2-config.json --rcc-path /absolute/path/to/RCCService.');
