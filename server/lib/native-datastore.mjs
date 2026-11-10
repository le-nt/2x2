// Implements the native engine's persistence wire protocol. Values remain
// serialized JSON strings for its GetAsync/UpdateAsync cache and CAS handling.
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {safeEqual} from './auth.mjs';
const MAX_VALUE=65536,MAX_FORM=4*MAX_VALUE+16384,MAX_PLACE=64*1024**2,MAX_TOTAL=1024**3;
const actionPath=/^\/native\/persistence\/(getV2|set|increment|getSortedValues)$/;
function text(value,empty=false){
  if(typeof value!=='string' || (!empty&&!value) || Buffer.byteLength(value)>256 || /[\x00-\x1f\x7f]/.test(value))throw [400,'Invalid DataStore name or key.'];
  return value;
}
function integer(value){if(typeof value!=='string'||! /^-?\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw [400,'Invalid DataStore integer.'];return Number(value);}
async function form(req){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>MAX_FORM)throw [413,'DataStore request too large.'];chunks.push(chunk);}
  let bytes=Buffer.concat(chunks);
  if(req.headers['content-encoding']==='gzip')bytes=gunzipSync(bytes,{maxOutputLength:MAX_FORM});
  else if(req.headers['content-encoding'] && req.headers['content-encoding']!=='identity')throw [415,'Unsupported DataStore encoding.'];
  return new URLSearchParams(bytes.toString('utf8').trim());
}
function valueJSON(serialized,type){
  if(typeof serialized!=='string'||!serialized.length||Buffer.byteLength(serialized)>MAX_VALUE)throw [413,'DataStore value exceeds 64 KiB.'];
  let value;try{value=JSON.parse(serialized);}catch{throw [400,'DataStore value must be JSON.'];}
  if(value===null)throw [400,'A DataStore value cannot be nil.'];
  const queue=[[value,0]];let count=0;
  while(queue.length){const [item,depth]=queue.pop();if(depth>64||++count>20000)throw [400,'DataStore value nesting exceeds limits.'];
    if(typeof item==='number'&&!Number.isFinite(item))throw [400,'DataStore numbers must be finite.'];
    if(item&&typeof item==='object')for(const child of Object.values(item))queue.push([child,depth+1]);
  }
  if(type==='sorted'&&!Number.isSafeInteger(value))throw [400,'Ordered DataStore values must be safe integers.'];
  return value;
}
export function createNativeDataStore({db,authorize,signingKey}) {
  db.exec(`CREATE TABLE IF NOT EXISTS native_datastore_values (
    place_id INTEGER NOT NULL, store_type TEXT NOT NULL, scope TEXT NOT NULL,
    store_name TEXT NOT NULL, entry_key TEXT NOT NULL, value TEXT NOT NULL,
    bytes INTEGER NOT NULL, numeric_value REAL, version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL, PRIMARY KEY(place_id,store_type,scope,store_name,entry_key));
    CREATE TABLE IF NOT EXISTS native_datastore_usage (
    place_id INTEGER PRIMARY KEY, bytes INTEGER NOT NULL DEFAULT 0, entries INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS native_datastore_sorted ON native_datastore_values(place_id,store_type,scope,store_name,numeric_value,entry_key);`);
  const rates=new Map(),q=sql=>db.prepare(sql);
  const identity=(place,type,scope,key,target)=>[place,type,text(scope),target?text(key):'',target?text(target):text(key)];
  const lookup=keys=>q('SELECT value,bytes FROM native_datastore_values WHERE place_id=? AND store_type=? AND scope=? AND store_name=? AND entry_key=?').get(...keys);
  const signature=payload=>crypto.createHmac('sha256',signingKey).update('datastore-cursor:'+payload).digest('base64url');
  function write(keys,serialized,type,expected,increment){
    db.exec('BEGIN IMMEDIATE');
    try{
      const previous=lookup(keys),current=previous?.value||'';
      if(expected!==undefined && expected!==current){db.exec('ROLLBACK');return {error:'concurrent_update',currentValue:current||null};}
      if(increment!==undefined){const old=current?JSON.parse(current):0;
        if(!Number.isSafeInteger(old)||!Number.isSafeInteger(old+increment))throw [400,'Cannot increment a non-integer or overflowing value.'];
        serialized=String(old+increment);
      }
      const value=valueJSON(serialized,type),bytes=Buffer.byteLength(serialized),delta=bytes-(previous?.bytes||0);
      const usage=q('SELECT bytes,entries FROM native_datastore_usage WHERE place_id=?').get(keys[0])||{bytes:0,entries:0};
      const total=q('SELECT COALESCE(SUM(bytes),0) AS bytes FROM native_datastore_usage').get().bytes;
      if(usage.bytes+delta>MAX_PLACE || total+delta>MAX_TOTAL || (!previous&&usage.entries>=100000))throw [507,'DataStore storage quota reached.'];
      q(`INSERT INTO native_datastore_values(place_id,store_type,scope,store_name,entry_key,value,bytes,numeric_value,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(place_id,store_type,scope,store_name,entry_key) DO UPDATE SET value=excluded.value,bytes=excluded.bytes,numeric_value=excluded.numeric_value,version=version+1,updated_at=excluded.updated_at`).run(...keys,serialized,bytes,type==='sorted'?value:null,Date.now());
      q('INSERT INTO native_datastore_usage(place_id,bytes,entries) VALUES (?,?,?) ON CONFLICT(place_id) DO UPDATE SET bytes=bytes+excluded.bytes,entries=entries+excluded.entries').run(keys[0],delta,previous?0:1);
      db.exec('COMMIT');return {data:serialized};
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  return async function route(req,res,url,{service}){
    const match=url.pathname.match(actionPath);if(!match)return false;
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));return true;};
    try{
      if(!service)throw [403,'Native worker authentication required.'];
      const place=integer(url.searchParams.get('placeId'));
      const context=authorize(req,place);
      if(!context)throw [403,'DataStore request does not match a registered game job.'];
      const now=Date.now(),rate=rates.get(context.jobId);
      if(rate && now-rate.start<60000 && rate.count>=600)throw [429,'DataStore request rate exceeded.'];
      rates.delete(context.jobId);if(rates.size>=1000)rates.delete(rates.keys().next().value);
      rates.set(context.jobId,rate&&now-rate.start<60000?{...rate,count:rate.count+1}:{start:now,count:1});
      const type=url.searchParams.get('type'),scope=text(url.searchParams.get('scope'));
      if(!['standard','sorted'].includes(type))throw [400,'Unknown DataStore type.'];
      const action=match[1];
      if(req.method!=='POST' && !(action==='getSortedValues'&&req.method==='GET'))throw [405,'Use the native DataStore request method.'];
      if(action==='getV2'){
        const body=await form(req),groups=new Map();
        for(const [key,value] of body){const part=key.match(/^qkeys\[(\d{1,2})\]\.(scope|key|target)$/);
          if(!part)throw [400,'Invalid batch DataStore key.'];
          const index=Number(part[1]);if(!groups.has(index))groups.set(index,{});
          const group=groups.get(index);if(Object.hasOwn(group,part[2]))throw [400,'Duplicate batch DataStore field.'];group[part[2]]=value;
        }
        if(!groups.size||groups.size>100)throw [400,'DataStore batch must contain 1–100 keys.'];
        const data=[];
        for(const group of groups.values()){
          if(group.scope!==scope || typeof group.target!=='string')throw [400,'Invalid batch DataStore scope or target.'];
          const keys=identity(place,type,scope,group.key,group.target),row=lookup(keys);
          if(row)data.push({Scope:scope,Key:group.key,Target:group.target,Value:row.value});
        }
        return send(200,{data});
      }
      if(action==='getSortedValues'){
        if(type!=='sorted')throw [400,'Sorted requests require an ordered store.'];
        const store=text(url.searchParams.get('key')),size=integer(url.searchParams.get('pageSize'));
        const direction=url.searchParams.get('ascending');if(size<1||size>100||! /^(true|false)$/i.test(direction||''))throw [400,'Invalid ordered page parameters.'];
        const ascending=direction.toLowerCase()==='true';
        const min=url.searchParams.has('inclusiveMinValue')?integer(url.searchParams.get('inclusiveMinValue')):null;
        const max=url.searchParams.has('inclusiveMaxValue')?integer(url.searchParams.get('inclusiveMaxValue')):null;
        const binding=JSON.stringify([place,type,scope,store,size,ascending,min,max]);
        let after;
        if(url.searchParams.has('exclusiveStartKey')){
          const token=url.searchParams.get('exclusiveStartKey');if(token.length>2048||! /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))throw [400,'Invalid ordered cursor.'];
          const [payload,mac]=token.split('.');if(!safeEqual(signature(payload),mac))throw [400,'Invalid ordered cursor.'];
          try{after=JSON.parse(Buffer.from(payload,'base64url'));}catch{throw [400,'Invalid ordered cursor.'];}
          if(after.binding!==binding||!Number.isSafeInteger(after.value)||typeof after.key!=='string')throw [400,'Ordered cursor does not match this request.'];
        }
        let where='place_id=? AND store_type=? AND scope=? AND store_name=?';const args=[place,type,scope,store];
        if(min!==null){where+=' AND numeric_value>=?';args.push(min);}if(max!==null){where+=' AND numeric_value<=?';args.push(max);}
        if(after){where+=` AND (numeric_value${ascending?'>':'<'}? OR (numeric_value=? AND entry_key>?))`;args.push(after.value,after.value,after.key);}
        const rows=q(`SELECT entry_key,numeric_value FROM native_datastore_values WHERE ${where} ORDER BY numeric_value ${ascending?'ASC':'DESC'},entry_key ASC LIMIT ?`).all(...args,size+1);
        const entries=rows.slice(0,size),data={Entries:entries.map(row=>({Target:row.entry_key,Value:row.numeric_value}))};
        if(rows.length>size){const last=entries.at(-1),payload=Buffer.from(JSON.stringify({binding,key:last.entry_key,value:last.numeric_value})).toString('base64url');data.ExclusiveStartKey=payload+'.'+signature(payload);}
        return send(200,{data});
      }
      const key=url.searchParams.get('key'),target=text(url.searchParams.get('target'),true),keys=identity(place,type,scope,key,target);
      if(action==='increment')return send(200,write(keys,null,type,undefined,integer(url.searchParams.get('value'))));
      const body=await form(req),value=body.get('value');valueJSON(value,type);
      if(integer(url.searchParams.get('valueLength'))!==Buffer.byteLength(value))throw [400,'DataStore value length mismatch.'];
      let expected;
      if(url.searchParams.has('expectedValueLength')){
        expected=body.get('expectedValue');if(typeof expected!=='string'||integer(url.searchParams.get('expectedValueLength'))!==Buffer.byteLength(expected))throw [400,'DataStore expected value length mismatch.'];
      }
      return send(200,write(keys,value,type,expected));
    }catch(error){return send(Array.isArray(error)?error[0]:500,{error:Array.isArray(error)?error[1]:'DataStore request failed.'});}
  };
}
