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
  await page.evaluate(()=>Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_,reject)=>setTimeout(()=>reject(Error('Service Worker did not activate')),15000))
  ]));
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:15000});
  const cache=await page.evaluate(async()=>{
    const all=await caches.keys();
    const key=all.find(k=>k.startsWith('omega-ii-v'));
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
  // The diagnostic report is generated and readable even with no network.
  await page.locator('#evDiagnosticShow').click();
  const diag=JSON.parse(await page.locator('#evDiagnosticText').inputValue());
  assert.equal(diag.version,'3.14');
  assert.equal(diag.mode,'all');
  assert.equal(diag.knownRemaining,413);
  assert.equal(diag.player.join(','),'10,5');
  assert.equal(diag.visibleCounts['7'],1);
  assert.equal(diag.status,'complete');


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
  assert.match(await page.locator('#evResult').innerText(),/по одной карте/);
  assert.match(await page.locator('#evResult').innerText(),/две полные руки/);
  // The public next-card display must use the same successful-peek
  // conditioning as the EV core, even while the PWA is offline.
  await page.evaluate(()=>window.__OMEGA_MINI_TEST__.setState({
    player:['10','9'],dealer:['A'],other:[],history:[],
    selected:'player',surrender:false,splitPolicy:'rank'
  }));
  await page.locator('#evPeek').selectOption('yes');
  const conditioned=await page.evaluate(()=>window.__OMEGA_MINI_TEST__.stats().ten);
  assert.ok(Math.abs(conditioned-127/412)<1e-12);
  assert.match(await page.locator('#probHint').innerText(),/peek/);
  await page.locator('#evPeek').selectOption('no');
  const ordinary=await page.evaluate(()=>window.__OMEGA_MINI_TEST__.stats().ten);
  assert.ok(Math.abs(ordinary-127/413)<1e-12);
  await page.locator('#evSoft').selectOption('h17');
  await page.locator('#evCharlie').selectOption('7');
  await page.locator('#evBJPayout').selectOption('1.2');
  await page.locator('#surrenderTiming').selectOption('early');
  // Reopen offline: cards and explicitly chosen rules must survive restart.
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  assert.equal(await page.locator('#evPeek').inputValue(),'no');
  assert.equal(await page.locator('#evSoft').inputValue(),'h17');
  assert.equal(await page.locator('#evCharlie').inputValue(),'7');
  assert.equal(await page.locator('#evBJPayout').inputValue(),'1.2');
  assert.equal(await page.locator('#surrenderTiming').inputValue(),'early');
  assert.equal((await page.evaluate(()=>window.__OMEGA_MINI_TEST__.getState())).dealer[0],'A');
  assert.ok(Math.abs(await page.evaluate(()=>window.__OMEGA_MINI_TEST__.stats().ten)-127/413)<1e-12);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile horizontal overflow');
  assert.deepEqual(issues,[], 'No page Javascript errors');
  console.log('PASS Chromium offline PWA: cached Worker, full EV, DOUBLE, SPLIT, mobile layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
