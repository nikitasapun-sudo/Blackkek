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
assert.match(latestSW,/omega-ii-v325-1/);
const oldHTML=latestHTML.replaceAll('v3.25','v3.14');
const oldSW=latestSW.replaceAll('omega-ii-v325-1','omega-ii-v314-upgrade-fixture').replace('RELEASE_NUMBER=325','RELEASE_NUMBER=314');
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
 await listen();const base='http://127.0.0.1:'+server.address().port+'/';const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await page.locator('#rulesPanel').click();await page.locator('#evSoft').selectOption('h17');
  await page.evaluate(()=>localStorage.setItem('omega-mini-edu-v1','legacy-cards-preserved'));
  await page.waitForFunction(()=>Object.keys(window.__OMEGA_TRAINER_TEST__.getTask().actions).length>0);
  await ctx.setOffline(true);await page.reload();await page.waitForFunction(()=>Object.keys(window.__OMEGA_TRAINER_TEST__.getTask().actions).length>0);assert.match(await page.title(),/v3.14/);assert.equal(await page.locator('#evSoft').inputValue(),'h17');
  await ctx.setOffline(false);upgraded=true;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await page.locator('#appUpdateNotice').waitFor({state:'visible',timeout:20000});assert.equal(await page.locator('#strategyResult').textContent(),'');assert.equal(await page.locator('#strategyNew').isDisabled(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('omega-mini-edu-v1')),'legacy-cards-preserved');
  await page.locator('#appUpdateReload').click();await page.waitForLoadState('domcontentloaded');assert.match(await page.title(),/v3.25/);assert.equal(await page.locator('#evSoft').inputValue(),'h17');
  await ctx.setOffline(true);await page.goto(base+'index.html?update=325');await page.waitForFunction(()=>Object.keys(window.__OMEGA_TRAINER_TEST__.getTask().actions).length>0);
  assert.equal((await page.evaluate(()=>window.__OMEGA_TRAINER_TEST__.input())).visible.length,3);assert.equal(await page.locator('#appUpdateNotice').isHidden(),true);
  await page.waitForFunction(async()=>{const keys=(await caches.keys()).filter(k=>k.startsWith('omega-ii-'));return keys.length===1&&keys[0]==='omega-ii-v325-1';});
  assert.deepEqual(errors,[]);console.log('PASS Chromium upgrade: stale hint invalidation, settings and legacy data retained, fresh independent tasks after offline restart');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>stop());
