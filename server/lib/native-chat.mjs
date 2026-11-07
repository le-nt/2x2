// Compatibility protocol for this deployment's RCC chat service.
// This is a local text policy, not Roblox's hosted moderation service.
import {gunzipSync} from 'node:zlib';
import {RateLimiter} from './auth.mjs';

const MAX_BODY=65536;
const reply=(res,status,value)=>{
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(value));
  return true;
};

async function form(req){
  const parts=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size<=MAX_BODY)parts.push(chunk);}
  if(size>MAX_BODY)throw {status:413};
  let data=Buffer.concat(parts);
  const encoding=req.headers['content-encoding'];
  if(encoding==='gzip'){
    try{data=gunzipSync(data,{maxOutputLength:MAX_BODY});}catch{throw {status:400};}
  }else if(encoding&&encoding!=='identity')throw {status:415};
  if((req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded')throw {status:415};
  return new URLSearchParams(data.toString('utf8'));
}

export function createNativeChat({db,config={}}){
  const limiter=new RateLimiter(6,5000);
  const terms=Array.isArray(config?.blockedTerms)?config.blockedTerms:[];
  const blocked=terms.filter(t=>typeof t==='string'&&t.trim()&&t.length<=80).slice(0,2000)
    .map(t=>new RegExp(t.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'giu'));
  const known=id=>/^[1-9][0-9]{0,15}$/.test(id||'')&&Number.isSafeInteger(Number(id))
    &&db.prepare('SELECT id FROM users WHERE id=?').get(Number(id));
  return async function route(req,res,url,{service,user}){
    const player=/^\/native\/api\/game\/players\/([1-9][0-9]{0,15})$/.exec(url.pathname);
    if(player){
      if(req.method!=='GET')return reply(res,405,{error:'Use GET.'});
      if(!service&&user?.id!==Number(player[1]))return reply(res,403,{error:'Worker credentials required.'});
      if(!known(player[1]))return reply(res,404,{error:'Unknown player.'});
      return reply(res,200,{ChatFilter:'blacklist'});
    }
    if(url.pathname!=='/native/api/moderation/filtertext')return false;
    if(!service)return reply(res,403,{error:'Worker credentials required.'});
    if(req.method!=='POST')return reply(res,405,{error:'Use POST.'});
    let params;
    try{params=await form(req);}catch(error){return reply(res,error.status||400,{error:'Invalid chat form.'});}
    const ids=params.getAll('userId'),messages=params.getAll('text');
    if(ids.length>1||messages.length!==1||!messages[0].trim()||messages[0].length>400)
      return reply(res,400,{error:'Provide one message of 1–400 characters.'});
    // Older RCC requests contain only filters and text; newer ones include userId.
    if(ids.length&&!known(ids[0]))return reply(res,400,{error:'Invalid chat player.'});
    const key=ids.length?ids[0]:'legacy-worker';
    if(limiter.blocked(key))return reply(res,429,{error:'Chat rate limit reached.'});
    limiter.hit(key);
    let message=messages[0].replace(/[\u0000-\u001f\u007f]/g,' ').trim();
    if(!message)return reply(res,400,{error:'Message is empty.'});
    for(const term of blocked)message=message.replace(term,match=>'#'.repeat(match.length));
    // The engine requires both keys even when all accounts use the same local policy.
    return reply(res,200,{data:{white:message,black:message}});
  };
}
