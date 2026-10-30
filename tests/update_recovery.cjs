'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {URL}=require('node:url');

const page=fs.readFileSync('update.html','utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Missing update helper JavaScript');
new vm.Script(script,{filename:'update-helper.js'});
const sw=fs.readFileSync('sw.js','utf8');
assert.ok(!sw.includes("'./update.html'"),'Update helper must remain network-accessible under old Service Workers');
assert.ok(fs.readFileSync('.github/workflows/publish-pages.yml','utf8').includes('cp update.html _site/'),'Publish must include update helper');
assert.ok(fs.readFileSync('index.html','utf8').includes('href="./update.html"'),'Application needs a link to update helper');
assert.ok(!/localStorage\s*\.|indexedDB\s*\.|caches\.delete\s*\(|unregister\s*\(/.test(script),'Helper must not delete or modify user storage');

function makeResponse(body){
  return {ok:true,status:200,clone(){return makeResponse(body);},async text(){return body;}};
}
async function probe({stale=false,online=true,existing=true}={}){
  const ui={status:{textContent:''},retry:{disabled:false,addEventListener(event,handler){assert.equal(event,'click');this.click=handler;}},open:{hidden:true}};
  let updates=0,registrations=0,writes=[];
  const registration={active:{state:'activated'},installing:null,waiting:null,async update(){updates++;}};
  const navigator={serviceWorker:{
    async getRegistration(){return existing?registration:null;},
    async register(){registrations++;return registration;}
  }};
  const latest='<title>Blackjack Omega II v3.25 · Offline EV</title>';
  const old='<title>Blackjack Omega II v3.23 · Offline EV</title>';
  const stored=new Map([['./index.html',makeResponse(stale?old:latest)],['./omega_worker.js',makeResponse('worker')],['./omega_v34_core.js',makeResponse('core')]]);
  const cache={
    async match(path){return stored.get(path)||null;},
    async put(path,res){writes.push(path);stored.set(path,res.clone());}
  };
  const context={
    document:{getElementById(id){return ui[id];}},
    navigator,window:{caches:true},location:{href:'https://example.test/Blackkek/update.html'},URL,Date,
    caches:{async keys(){return ['omega-ii-v325-1'];},async open(){return cache;}},
    fetch:async url=>{
      if(!online)return {ok:false,status:503};
      if(String(url).includes('sw.js'))return makeResponse("const CACHE='omega-ii-v325-1'; const RELEASE_NUMBER=325;");
      if(String(url).includes('index.html'))return makeResponse(latest);
      if(String(url).includes('omega_worker.js'))return makeResponse('worker');
      if(String(url).includes('omega_v34_core.js'))return makeResponse('core');
      throw Error('unexpected fetch: '+url);
    },
    setTimeout,Promise,Error,String,Number
  };
  await vm.runInNewContext(script,context,{timeout:2000});
  return {ui,updates,registrations,writes,cache};
}
(async()=>{
  const current=await probe();
  assert.equal(current.updates,1);
  assert.equal(current.registrations,0);
  assert.equal(current.ui.open.hidden,false);
  assert.deepEqual(current.writes,[]);
  assert.match(current.ui.status.textContent,/v3\.25/);
  const clean=await probe({existing:false});
  assert.equal(clean.registrations,1);
  assert.equal(clean.ui.open.hidden,false);
  const stale=await probe({stale:true});
  assert.equal(stale.ui.open.hidden,false);
  assert.deepEqual(stale.writes,['./index.html','./omega_worker.js','./omega_v34_core.js','./']);
  assert.match(await (await stale.cache.match('./index.html')).text(),/v3\.25/);
  const offline=await probe({online:false});
  assert.equal(offline.updates,0);
  assert.equal(offline.ui.open.hidden,true);
  assert.match(offline.ui.status.textContent,/Сохранённые данные не очищались/);
  assert.equal(offline.ui.retry.disabled,false);
  console.log('PASS: safe update recovery verifies and repairs stale cached HTML without touching localStorage');
})().catch(e=>{console.error(e);process.exitCode=1});