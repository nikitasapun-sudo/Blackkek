'use strict';
// End-to-end Chromium lifecycle regression: a synthetic *previous* release,
// restart while offline (including a cache-busting query URL), then install
// the candidate Service Worker update over the same persistent browser context.
// Verify old results are invalidated and the user's stored cards and rules
// survive activation, reload and another offline restart.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const latestHTML=fs.readFileSync('index.html','utf8');
const latestSW=fs.readFileSync('sw.js','utf8');
assert.match(latestSW,/omega-ii-v324-1/);
const oldHTML=latestHTML.replaceAll('v3.24','v3.14');
const oldSW=latestSW.replaceAll('omega-ii-v324-1','omega-ii-v314-upgrade-fixture').replace('RELEASE_NUMBER=324','RELEASE_NUMBER=314');
let upgraded=false;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 let body,kind='text/plain; charset=utf-8';
 if(url.pathname==='/'||url.pathname==='/index.html'){
  body=upgraded?latestHTML:oldHTML;
  kind='text/html; charset=utf-8';
 }else if(url.pathname==='/sw.js'){
  body=upgraded?latestSW:oldSW;
  kind='application/javascript; charset=utf-8';
 }else{
  const f=url.pathname.replace(/^\//,'');
  if(!['manifest.webmanifest','omega_worker.js','omega_v34_core.js','icons/icon.svg'].includes(f)){
   res.writeHead(404);res.end('Not found');return;
  }
  body=fs.readFileSync(path.join(process.cwd(),f));
  kind=f.endsWith('.js')?'application/javascript; charset=utf-8':
   f.endsWith('.svg')?'image/svg+xml':f.endsWith('.webmanifest')?'application/manifest+json':'text/plain';
 }
 res.writeHead(200,{'Content-Type':kind,'Cache-Control':'no-store'});
 res.end(body);
});
const listen=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const stop=()=>new Promise(resolve=>server.close(resolve));
(async()=>{
 await listen();
 const port=server.address().port;
 const base='http://127.0.0.1:'+port+'/';
 const browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 const errors=[];
 let page;
 try{
  page=await ctx.newPage();
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>navigator.serviceWorker?.controller!==null&&navigator.serviceWorker?.controller!==undefined,{timeout:15000});
  assert.match(await page.title(),/v3.14/);
  await page.evaluate(()=>window.__OMEGA_MINI_TEST__.setState({
   player:['5','6'],dealer:['7'],other:['10','A'],history:['2','3'],
   selected:'player',surrender:true,splitPolicy:'rank'
  }));
  await page.locator('#evPeek').selectOption('no');
  await page.locator('#evSoft').selectOption('h17');
  await page.locator('#evCharlie').selectOption('7');
  await page.locator('#evBJPayout').selectOption('1.2');
  // Make a completed result to assert an upgrade cannot leave it visible.
  await page.locator('#evDoubleCompute').click();
  await page.waitForFunction(()=>document.querySelector('#evStatus').textContent.includes('Расчёт завершён'),{timeout:20000});
  assert.match(await page.locator('#evResult').innerText(),/Удвоение/);
  const saved=await page.evaluate(()=>({
   cards:window.__OMEGA_MINI_TEST__.getState(),
   rules:JSON.parse(localStorage.getItem('omega-mini-edu-ev-rules-v1'))
  }));
  // Simulate closing the Android app (page) without clearing its origin data.
  await page.close();
  await ctx.setOffline(true);
  page=await ctx.newPage();
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(base+'index.html?update=314',{waitUntil:'domcontentloaded',timeout:15000});
  assert.match(await page.title(),/v3.14/);
  assert.deepEqual(await page.evaluate(()=>window.__OMEGA_MINI_TEST__.getState()),saved.cards);
  assert.equal(await page.locator('#evSoft').inputValue(),'h17');
  assert.equal(await page.locator('#evCharlie').inputValue(),'7');
  // A previous calculation must NOT survive the app process restart.
  assert.equal(await page.locator('#evResult').innerText(),'');
  await ctx.setOffline(false);
  upgraded=true;
  // Explicitly check for a new Service Worker; this runs a real install,
  // activate, old-cache deletion and clients.claim against the test HTTP server.
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#appUpdateNotice')).some(x=>!x.hidden),{timeout:20000});
  assert.equal(await page.locator('#evResult').innerText(),'');
  assert.match(await page.locator('#evStatus').innerText(),/Новая версия/);
  assert.deepEqual(await page.evaluate(()=>window.__OMEGA_MINI_TEST__.getState()),saved.cards);
  // An old controller may briefly reopen its own cache during the handoff.
  // The active controller must be the new version and its complete cache must
  // exist. The updated SW reads ONLY its versioned cache.
  const active=await page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.ready;
   const keys=await caches.keys();
   const cached=await caches.open('omega-ii-v324-1');
   return {
    script:registration.active?.scriptURL,
    keys,
    html:Boolean(await cached.match('./index.html')),
    math:Boolean(await cached.match('./omega_v34_core.js')),
    worker:Boolean(await cached.match('./omega_worker.js'))
   };
  });
  assert.match(active.script,/sw\.js$/);
  assert.ok(active.keys.includes('omega-ii-v324-1'));
  assert.ok(active.html&&active.math&&active.worker,'New version cache must be complete');
  await page.locator('#appUpdateReload').click();
  await page.waitForLoadState('domcontentloaded');
  assert.match(await page.title(),/v3.24/);
  assert.deepEqual(await page.evaluate(()=>window.__OMEGA_MINI_TEST__.getState()),saved.cards);
  for(const [id,expected] of [['evPeek','no'],['evSoft','h17'],['evCharlie','7'],['evBJPayout','1.2']])
   assert.equal(await page.locator('#'+id).inputValue(),expected,id+' lost after upgrade');
  assert.equal(await page.locator('#appUpdateNotice').isHidden(),true);
  // The first navigation under the new controller also repairs any old
  // cache recreated during controller handoff, without touching new releases.
  await page.waitForFunction(async()=>{
   const keys=(await caches.keys()).filter(x=>x.startsWith('omega-ii-'));
   return keys.length===1&&keys[0]==='omega-ii-v324-1';
  },null,{timeout:10000});
  await ctx.setOffline(true);
  await page.close();
  page=await ctx.newPage();
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(base+'?update=319',{waitUntil:'domcontentloaded',timeout:15000});
  assert.match(await page.title(),/v3.24/);
  assert.deepEqual(await page.evaluate(()=>window.__OMEGA_MINI_TEST__.getState()),saved.cards);
  assert.equal(await page.locator('#evSoft').inputValue(),'h17');
  await page.locator('#evDoubleCompute').click();
  await page.waitForFunction(()=>document.querySelector('#evStatus').textContent.includes('Расчёт завершён'),{timeout:20000});
  assert.match(await page.locator('#evResult').innerText(),/Удвоение/);
  assert.deepEqual(errors,[],'No page errors across old/new offline reloads');
  console.log('PASS Chromium PWA upgrade: offline close/reopen, query navigation, live SW replacement, race-safe old-cache cleanup, retained cards/rules, stale EV invalidation');
 }finally{
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>stop());
