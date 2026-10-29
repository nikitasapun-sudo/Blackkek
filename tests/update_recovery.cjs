'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const page=fs.readFileSync('update.html','utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Missing update helper JavaScript');
new vm.Script(script,{filename:'update-helper.js'});
const sw=fs.readFileSync('sw.js','utf8');
assert.ok(!sw.includes("'./update.html'"),'Update helper must remain network-accessible under old Service Workers');
assert.ok(fs.readFileSync('.github/workflows/publish-pages.yml','utf8').includes('cp update.html _site/'),'Publish must include update helper');
assert.ok(fs.readFileSync('index.html','utf8').includes('href="./update.html"'),'Application needs a link to update helper');
assert.ok(!/localStorage\s*\.|indexedDB\s*\.|caches\.delete\s*\(|unregister\s*\(/.test(script),'Helper must not delete or modify user storage');

async function probe(existing=true,serverOK=true){
  const ui={status:{textContent:''},retry:{disabled:false,addEventListener(event,handler){assert.equal(event,'click');this.click=handler;}},open:{hidden:true}};
  let updates=0,registrations=0;
  const registration={active:{state:'activated'},installing:null,waiting:null,async update(){updates++;}};
  const navigator={serviceWorker:{
    async getRegistration(){return existing?registration:null;},
    async register(){registrations++;return registration;}
  }};
  const cache={async match(){return {ok:true}}};
  const context={
    document:{getElementById(id){return ui[id];}},
    navigator,window:{caches:true},
    caches:{async keys(){return ['omega-ii-v324-1'];},async open(){return cache;}},
    fetch:async()=>({ok:serverOK,status:503,async text(){return "const CACHE='omega-ii-v324-1';";}}),
    setTimeout,Promise,Error,String
  };
  await vm.runInNewContext(script,context,{timeout:2000});
  return {ui,updates,registrations};
}
(async()=>{
  const installed=await probe(true,true);
  assert.equal(installed.updates,1);
  assert.equal(installed.registrations,0);
  assert.equal(installed.ui.open.hidden,false);
  assert.match(installed.ui.status.textContent,/Готово/);
  const clean=await probe(false,true);
  assert.equal(clean.registrations,1);
  assert.equal(clean.ui.open.hidden,false);
  const offline=await probe(true,false);
  assert.equal(offline.updates,0);
  assert.equal(offline.ui.open.hidden,true);
  assert.match(offline.ui.status.textContent,/Сохранённые данные не очищались/);
  assert.equal(offline.ui.retry.disabled,false);
  console.log('PASS: update recovery leaves site storage untouched and checks version from network');
})().catch(e=>{console.error(e);process.exitCode=1});
