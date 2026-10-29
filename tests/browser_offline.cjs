'use strict';
// Run after installing Playwright Chromium on a local HTTP server (localhost secure context).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.OMEGA_TEST_URL||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 const issues=[];
 page.on('pageerror',e=>issues.push(e.message));
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,{timeout:15000});
  const cache=await page.evaluate(async()=>{
    const all=await caches.keys();
    const key=all.find(k=>k.startsWith('omega-ii-v35-'));
    const shell=key&&await caches.open(key);
    return {key,worker:Boolean(shell&&await shell.match('./omega_worker.js')),
      core:Boolean(shell&&await shell.match('./omega_v34_core.js'))};
  });
  assert.ok(cache.key && cache.worker && cache.core,'Static Worker & math core missing in offline cache');

  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.evaluate(()=>window.__OMEGA_MINI_TEST__.setState({
    player:['10','5'],dealer:['7'],other:[],history:[],
    selected:'player',surrender:false,splitPolicy:'rank'
  }));
  await page.locator('#evCompute').click();
  await page.waitForFunction(()=>document.querySelector('#evStatus').textContent.includes('Расчёт завершён'),{timeout:20000});
  assert.match(await page.locator('#evResult').innerText(),/0,475618/);

  await page.evaluate(()=>window.__OMEGA_MINI_TEST__.setState({
    player:['5','6'],dealer:['7'],other:[],history:[],
    selected:'player',surrender:false,splitPolicy:'rank'
  }));
  assert.equal(await page.locator('#evDoubleCompute').isDisabled(),false,'Double should be available');
  assert.equal(await page.locator('#evSplitCompute').isDisabled(),true,'Split should be unavailable');
  await page.locator('#evDoubleCompute').click();
  await page.waitForFunction(()=>document.querySelector('#evStatus').textContent.includes('Расчёт завершён'),{timeout:20000});
  assert.match(await page.locator('#evResult').innerText(),/Удвоение/);

  await page.evaluate(()=>window.__OMEGA_MINI_TEST__.setState({
    player:['A','A'],dealer:['7'],other:[],history:[],
    selected:'player',surrender:false,splitPolicy:'rank'
  }));
  assert.equal(await page.locator('#evSplitCompute').isDisabled(),false,'Split should be available');
  await page.locator('#evSplitCompute').click();
  await page.waitForFunction(()=>document.querySelector('#evStatus').textContent.includes('Расчёт завершён'),{timeout:20000});
  assert.match(await page.locator('#evResult').innerText(),/0,472412/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile horizontal overflow');
  assert.deepEqual(issues,[], 'No page Javascript errors');
  console.log('PASS Chromium offline PWA: cached Worker, full EV, DOUBLE, SPLIT, mobile layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
