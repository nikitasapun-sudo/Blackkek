'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.OMEGA_TEST_URL||'http://127.0.0.1:8765/';
const KEY='omega-mini-edu-v1',RULE='omega-mini-edu-ev-rules-v1';
const state={player:['5','6'],dealer:['7'],other:[],history:[],selected:'player',surrender:false,splitPolicy:'rank'};
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),errors=[];
  const a=await ctx.newPage();a.on('pageerror',e=>errors.push(e.message));
  await a.goto(base);
  await a.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  assert.equal(await a.evaluate(()=>Boolean(navigator.locks)),true);
  await a.evaluate(async({KEY,state})=>{await navigator.locks.request('omega-mini-storage',()=>localStorage.setItem(KEY,JSON.stringify(state)));},{KEY,state});
  await a.reload();
  const b=await ctx.newPage();b.on('pageerror',e=>errors.push(e.message));
  await b.goto(base);
  await ctx.setOffline(true);
  // Drain startup saves before injecting a predictable in-flight Worker.
  for(const p of [a,b])await p.evaluate(()=>navigator.locks.request('omega-mini-storage',()=>{}));
  await b.evaluate(()=>{
   window.RealWorker=Worker;
   window.Worker=class {constructor(){window.testWorker=this;}postMessage(){}terminate(){this.dead=true;}};
  });
  await b.locator('#evDoubleCompute').click();
  await b.evaluate(()=>window.testWorker.onmessage({data:{type:'basic',value:{actions:{double:123},splitEligible:false}}}));
  assert.match(await b.locator('#evResult').innerText(),/123/);
  await a.locator('#ranks button[data-rank="2"]').click();
  await b.locator('#tabConflictNotice').waitFor({state:'visible'});
  assert.equal(await b.evaluate(()=>window.testWorker.dead),true);
  assert.equal(await b.locator('#evResult').innerText(),'');
  assert.equal(await b.locator('#evCompute').isDisabled(),true);
  await b.evaluate(()=>window.testWorker.onmessage({data:{type:'basic',value:{actions:{double:999}}}}));
  assert.equal(await b.locator('#evResult').innerText(),'');
  const saved=await a.evaluate(key=>localStorage.getItem(key),KEY);
  await b.evaluate(()=>{document.querySelector('#next').onclick();document.querySelector('#reset').onclick();});
  assert.equal(await a.evaluate(key=>localStorage.getItem(key),KEY),saved);
  await b.locator('#tabConflictReload').click();
  await b.waitForFunction(()=>document.querySelector('#tabConflictNotice').hidden);
  assert.deepEqual(await b.evaluate(()=>window.__OMEGA_MINI_TEST__.getState().player),['5','6','2']);
  // Rule changes invalidate other tabs too, including completed diagnostics.
  await a.locator('#evSoft').selectOption('h17');
  await b.locator('#tabConflictNotice').waitFor({state:'visible'});
  await b.locator('#tabConflictReload').click();
  await b.waitForFunction(()=>document.querySelector('#evSoft').value==='h17');
  // Hold the shared lock while both tabs enqueue different saves from one baseline.
  await a.evaluate(()=>{window.lockReady=false;navigator.locks.request('omega-mini-storage',()=>new Promise(resolve=>{window.releaseLock=resolve;window.lockReady=true;}));});
  await a.waitForFunction(()=>window.lockReady);
  await a.locator('#ranks button[data-rank="3"]').click();
  await b.locator('#ranks button[data-rank="4"]').click();
  await a.evaluate(()=>window.releaseLock());
  await b.locator('#tabConflictNotice').waitFor({state:'visible'});
  assert.deepEqual(await a.evaluate(key=>JSON.parse(localStorage.getItem(key)).player,KEY),['5','6','2','3']);
  await b.locator('#tabConflictReload').click();
  await b.waitForFunction(()=>document.querySelector('#tabConflictNotice').hidden);
  // Unrelated keys do not interfere; removal of an app key does.
  await a.evaluate(()=>localStorage.setItem('unrelated-example','1'));
  await b.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.equal(await b.locator('#tabConflictNotice').isHidden(),true);
  await a.evaluate(key=>localStorage.removeItem(key),RULE);
  await b.locator('#tabConflictNotice').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  console.log('PASS two offline Chromium tabs: Worker cancellation, stale reply rejection, manual reload, rules, queued simultaneous saves, unrelated key and removal');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
