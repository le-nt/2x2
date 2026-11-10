#!/usr/bin/env node
import fs from 'node:fs';

const [beforeFile,afterFile]=process.argv.slice(2);
if(!beforeFile||!afterFile||process.argv.length!==4)throw Error('Usage: node tools/compare-compatibility-reports.mjs BEFORE.json AFTER.json');
function read(file){if(fs.statSync(file).size>32*1024*1024)throw Error('Report exceeds 32 MiB');return JSON.parse(fs.readFileSync(file,'utf8'));}
const before=read(beforeFile),after=read(afterFile);
if(before.placeId!==after.placeId)throw Error('Reports identify different places');
function entries(report){
  const values=new Map();
  for(const item of report.assets||[])values.set('asset:'+item.id,item.status);
  for(const item of report.resourceReferences||[])values.set('resource:'+item.reference,item.status);
  return values;
}
const old=entries(before),next=entries(after),changes=[];
for(const key of new Set([...old.keys(),...next.keys()]))
  if(old.get(key)!==next.get(key))changes.push({reference:key,before:old.get(key)||'not_observed',after:next.get(key)||'not_observed'});
function errors(report){return new Set((report.server?.errors||[]).map(e=>JSON.stringify({path:e.path,message:e.message})));}
const oldErrors=errors(before),newErrors=errors(after);
const hash=report=>report.placeSha256||report.placeAnalysis?.sha256||null;
function lifecycle(report){const counts={};for(const e of report.nativeLifecycle||[])counts[e.phase]=(counts[e.phase]||0)+1;return counts;}
console.log(JSON.stringify({schemaVersion:1,placeId:before.placeId,
  comparisonValidity:hash(before)&&hash(after)?hash(before)===hash(after)?'same_original_place':'different_original_bytes':'place_hash_not_recorded',
  dependencyChanges:changes,
  newErrors:[...newErrors].filter(e=>!oldErrors.has(e)).map(e=>JSON.parse(e)),
  noLongerObservedErrors:[...oldErrors].filter(e=>!newErrors.has(e)).map(e=>JSON.parse(e)),
  lifecycleBefore:lifecycle(before),lifecycleAfter:lifecycle(after),
  browserGameplayBefore:before.browserGameplay||before.gameplayStatus||'not_tested',
  browserGameplayAfter:after.browserGameplay||after.gameplayStatus||'not_tested',
  limitation:'No-longer-observed errors do not establish a fix when observation windows or exercised gameplay differ.'},null,2));
