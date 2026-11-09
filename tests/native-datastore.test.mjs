import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {Readable} from 'node:stream';
import {openDb} from '../server/lib/db.mjs';
import {createNativeDataStore} from '../server/lib/native-datastore.mjs';
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-datastore-')),db=openDb(dir);
 t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
 const route=createNativeDataStore({db,signingKey:'isolated-cursor-signing-key',authorize:(req,place)=>Number(req.headers['roblox-place-id'])===place?{jobId:'fixture-'+place}:null});
 async function call(action,query={},body='',headers={},service=true){
  const req=Readable.from([Buffer.from(typeof body==='string'?body:new URLSearchParams(body).toString())]);req.method='POST';req.headers={'roblox-place-id':'1',...headers};
  const url=new URL('http://localhost/native/persistence/'+action);url.search=new URLSearchParams({placeId:'1',type:'standard',scope:'global',...query});
  const result={};const res={writeHead(status){result.status=status;return this;},end(body){result.body=JSON.parse(body);}};
  assert.equal(await route(req,res,url,{service}),true);return result;
 }
 const get=(key='entry',query={},headers={})=>call('getV2',query,{'qkeys[0].scope':query.scope||'global','qkeys[0].key':'store','qkeys[0].target':key},headers);
 const set=(key,value,query={},extra={})=>{const serialized=JSON.stringify(value);return call('set',{key:'store',target:key,valueLength:String(Buffer.byteLength(serialized)),...query},{value:serialized,...extra});};
 return {db,call,get,set};
}
test('native persistence requires a matching worker context and returns nil for missing keys',async t=>{
 const {call,get,set}=fixture(t);
 assert.equal((await call('getV2',{},'',{},false)).status,403);
 assert.equal((await call('getV2',{placeId:'2'},'')).status,403);
 assert.deepEqual((await get()).body,{data:[]});
 const object={score:7,label:'original é data'};
 assert.equal((await set('entry',object)).status,200);
 assert.equal(JSON.parse((await get()).body.data[0].Value).label,object.label);
 assert.deepEqual((await get('entry',{scope:'other'})).body,{data:[]});
 assert.deepEqual((await get('entry',{placeId:'2'},{'roblox-place-id':'2'})).body,{data:[]});
 const legacyValue=JSON.stringify(42);
 assert.equal((await call('set',{key:'legacy-key',target:'',valueLength:String(legacyValue.length)},{value:legacyValue})).status,200);
 const legacy=await call('getV2',{}, {'qkeys[0].scope':'global','qkeys[0].key':'legacy-key','qkeys[0].target':''});
 assert.equal(legacy.body.data[0].Value,'42');
});
test('UpdateAsync compare-and-set returns the current serialized value on a conflict',async t=>{
 const {call,get,db}=fixture(t);
 const cas=(value,expected)=>call('set',{key:'store',target:'score',valueLength:String(value.length),expectedValueLength:String(expected.length)},{value,expectedValue:expected});
 assert.equal((await cas('7','')).status,200);
 assert.deepEqual((await cas('9','')).body,{error:'concurrent_update',currentValue:'7'});
 assert.deepEqual((await cas('11','7')).body,{data:'11'});
 assert.equal((await get('score')).body.data[0].Value,'11');
 assert.deepEqual({...db.prepare('SELECT bytes,entries FROM native_datastore_usage WHERE place_id=1').get()},{bytes:2,entries:1});
});
test('IncrementAsync is atomic and rejects incompatible values and overflow',async t=>{
 const {call,get,set}=fixture(t),increment=value=>call('increment',{key:'store',target:'count',value:String(value)});
 assert.deepEqual((await increment(5)).body,{data:'5'});
 assert.deepEqual((await increment(-2)).body,{data:'3'});
 await set('count',{invalid:true});assert.equal((await increment(1)).status,400);
 await set('count',Number.MAX_SAFE_INTEGER);assert.equal((await increment(1)).status,400);
 assert.equal(JSON.parse((await get('count')).body.data[0].Value),Number.MAX_SAFE_INTEGER);
});
test('ordered stores paginate tied values with signed, scope-bound cursors',async t=>{
 const {call,set}=fixture(t);
 for(const [key,value] of [['low',1],['a',5],['b',5],['high',9]])await set(key,value,{type:'sorted'});
 const query={type:'sorted',key:'store',pageSize:'2',ascending:'False'};
 const first=await call('getSortedValues',query);
 assert.deepEqual(first.body.data.Entries,[{Target:'high',Value:9},{Target:'a',Value:5}]);
 const token=first.body.data.ExclusiveStartKey;
 const second=await call('getSortedValues',{...query,exclusiveStartKey:token});
 assert.deepEqual(second.body.data.Entries,[{Target:'b',Value:5},{Target:'low',Value:1}]);
 assert.equal(second.body.data.ExclusiveStartKey,undefined);
 assert.equal((await call('getSortedValues',{...query,scope:'other',exclusiveStartKey:token})).status,400);
 assert.equal((await call('getSortedValues',{...query,exclusiveStartKey:token.slice(0,-1)+'!'})).status,400);
 const filtered=await call('getSortedValues',{...query,ascending:'True',pageSize:'10',inclusiveMinValue:'5',inclusiveMaxValue:'5'});
 assert.deepEqual(filtered.body.data.Entries,[{Target:'a',Value:5},{Target:'b',Value:5}]);
 assert.equal((await set('fraction',0.5,{type:'sorted'})).status,400);
});
test('persistence rejects oversized bodies, invalid JSON and mismatched native byte lengths',async t=>{
 const {call,set,db}=fixture(t);
 assert.equal((await set('huge','x'.repeat(65536))).status,413);
 assert.equal((await call('set',{key:'store',target:'bad',valueLength:'3'},{value:'not-json'})).status,400);
 assert.equal((await call('set',{key:'store',target:'bad',valueLength:'999'},{value:'7'})).status,400);
 assert.equal((await call('getV2',{},'x'.repeat(300000))).status,413);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM native_datastore_values').get().n,0);
});
