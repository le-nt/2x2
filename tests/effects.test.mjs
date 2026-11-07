import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('sound-control initialization and toggle execute without invalid assignment', async()=>{
 let button;const attributes={},storage=new Map();
 const bar={querySelector(){return button||null;},append(value){button=value;}};
 const document={hidden:false,documentElement:{dataset:{}},body:{},addEventListener(){},querySelector(selector){return selector==='.TopBar'?bar:null;},querySelectorAll(selector){return selector==='.SoundToggle'&&button?[button]:[];},createElement(){return{style:{},setAttribute(k,v){attributes[k]=v;},querySelector(){return{style:{}};},addEventListener(type,fn){if(type==='click')this.click=fn;}};}};
 const context={document,window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>({matches:false,addEventListener(){}}),MutationObserver:class{observe(){}},queueMicrotask,performance:{now:()=>1000},requestAnimationFrame:()=>1,cancelAnimationFrame(){},console};
 vm.runInNewContext(fs.readFileSync(new URL('../site/js/effects.js',import.meta.url),'utf8'),context);
 assert.equal(attributes['aria-label'],'Mute interface sounds');assert.equal(attributes['aria-pressed'],'true');
 await button.click({isTrusted:true});assert.equal(attributes['aria-label'],'Enable interface sounds');assert.equal(JSON.parse(storage.get('2x2.experience.v1')).sound,false);
});
