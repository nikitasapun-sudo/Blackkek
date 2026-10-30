'use strict';
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.OMEGA_TEST_URL||'http://127.0.0.1:8765/';
const ready=page=>page.waitForFunction(()=>Object.keys(window.__OMEGA_TRAINER_TEST__?.getTask()?.actions||{}).length>0);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await ready(page);
  assert.notEqual(await page.locator('#bestAction').innerText(),'Считаю…');assert.equal(await page.locator('#strategyAnswer').inputValue(),'');
  const cached=await page.evaluate(async()=>{const c=await caches.open('omega-ii-v325-1');return Boolean(await c.match('./omega_worker.js'))&&Boolean(await c.match('./omega_v34_core.js'));});assert.equal(cached,true);
  await context.setOffline(true);await page.reload();await ready(page);
  for(const scenario of [{player:['10','5'],up:'7'},{player:['A','7'],up:'9'},{player:['5','6'],up:'6'}]){
   await page.evaluate(s=>window.__OMEGA_TRAINER_TEST__.setTask(s),scenario);await ready(page);
   const data=await page.evaluate(()=>window.__OMEGA_TRAINER_TEST__.input());assert.deepEqual(data.visible,[...scenario.player,scenario.up]);
   assert.equal(await page.evaluate(()=>OmegaFiniteEV.numCards(OmegaFiniteEV.inputCounts(window.__OMEGA_TRAINER_TEST__.input()))),413);
  }
  await page.evaluate(()=>window.__OMEGA_TRAINER_TEST__.setTask({player:['A','A'],up:'7'}));await ready(page);await page.locator('#splitCompute').click();
  await page.waitForFunction(()=>Number.isFinite(window.__OMEGA_TRAINER_TEST__.getTask().actions.split));
  const split=await page.evaluate(()=>window.__OMEGA_TRAINER_TEST__.getTask().actions.split);assert.ok(Math.abs(split-0.47241182959770595)<1e-9);
  await page.locator('#rulesPanel').click();await page.locator('#evSoft').selectOption('h17');await ready(page);await page.reload();await ready(page);assert.equal(await page.locator('#evSoft').inputValue(),'h17');
  for(const width of [320,390,700]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
  await page.setViewportSize({width:390,height:844});fs.mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/trainer-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS Chromium offline trainer: immediate hints, fresh tasks, exact split, persisted rules and mobile widths');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
