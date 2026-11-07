import crypto from 'node:crypto';
export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export const mac = (secret, value) => crypto.createHmac('sha256', secret).update(value).digest('hex');
export function equal(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length && crypto.timingSafeEqual(x,y);}
export function issue(secret,purpose,claims,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({...claims,purpose,exp:now+120000})).toString('base64url');
 return payload+'.'+mac(secret,payload);
}
export function verify(secret,purpose,token,now=Date.now()){
 try{const [payload,sig,extra]=String(token||'').split('.');if(extra||!equal(sig,mac(secret,payload)))return null;const claims=JSON.parse(Buffer.from(payload,'base64url'));if(claims.purpose!==purpose||!Number.isFinite(claims.exp)||claims.exp<now||claims.exp>now+120000)return null;return claims;}catch{return null;}
}
// Matches the engine's actual s[1] install / s[2] preauthentication checks.
export function clientTicket(secret,user,job,appearance,timestamp=new Date().toISOString()){
 return [timestamp,mac(secret,`${user.id}\n${user.username}\n${appearance}\n${job}\n${timestamp}`),mac(secret,`${user.id}\n${job}\n${timestamp}`)].join(';');
}
export function safeRelative(value){return typeof value==='string'&&value.length>0&&!value.includes('\\')&&!value.includes('\0')&&!value.startsWith('/')&&!value.split('/').some(p=>p==='..'||p==='.'||p==='');}
