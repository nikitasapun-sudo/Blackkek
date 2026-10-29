'use strict';
// Reproduce the deployment race: a v3.24 service worker owns a cache
// containing a stale v3.23 HTML document, then the server becomes current.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const latestHTML=fs.readFileSync('index.html','utf8');
const oldHTML=latestHTML.replaceAll('v3.24','v3.23');
const latestSW=fs.readFileSync('sw.js','utf8');
const updateHTML=fs.readFileSync('update.html','utf8');
let serverIsCurrent=false;
const server=http.createServer((req,res)=>{
  const uri=new URL(req.url,'http://localhost');
  let body,kind='text/plain; charset=utf-8';
  if(uri.pathname==='/'||uri.pathname==='/index.html'){
    body=serverIsCurrent?latestHTML:oldHTML;
    kind='text/html; charset=utf-8';
  }else if(uri.pathname==='/update.html'){
    body=updateHTML;kind='text/html; charset=utf-8';
  }else if(uri.pathname==='/sw.js'){
    body=latestSW;kind='text/javascript; charset=utf-8';
  }else{
    const file=uri.pathname.replace(/^\//,'');
    if(!['manifest.webmanifest','omega_worker.js','omega_v34_core.js','icons/icon.svg'].includes(file)){
      res.writeHead(404);res.end('Not found');return;
    }
    body=fs.readFileSync(path.join(process.cwd(),file));
    kind=file.endsWith('.js')?'text/javascript; charset=utf-8':
      file.endsWith('.svg')?'image/svg+xml':'application/manifest+json';
  }
  res.writeHead(200,{'Content-Type':kind,'Cache-Control':'no-store'});
  res.end(body);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/';
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>navigator.serviceWorker?.controller!==null,{timeout:15000});
    assert.match(await page.title(),/v3\.23/);
    await page.evaluate(()=>window.__OMEGA_MINI_TEST__.setState({
      player:['5','6'],dealer:['7'],other:['10'],history:[],
      selected:'player',surrender:false,splitPolicy:'rank'
    }));
    await page.locator('#evSoft').selectOption('h17');
    const original=await page.evaluate(()=>({
      cards:window.__OMEGA_MINI_TEST__.getState(),
      rules:JSON.parse(localStorage.getItem('omega-mini-edu-ev-rules-v1'))
    }));
    // The server now has the new HTML, but its content remains stale
    // in the already-installed cache named omega-ii-v324-1.
    serverIsCurrent=true;
    await page.reload({waitUntil:'domcontentloaded'});
    assert.match(await page.title(),/v3\.23/);
    const before=await page.evaluate(async()=>{
      const cache=await caches.open('omega-ii-v324-1');
      return (await (await cache.match('./index.html')).text()).includes('Blackjack Omega II v3.23');
    });
    assert.equal(before,true);
    // update.html was never cached by the old worker.
    await page.goto(base+'update.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Готово:'),{timeout:25000});
    assert.match(await page.locator('#status').textContent(),/v3\.24/);
    const after=await page.evaluate(async()=>{
      const cache=await caches.open('omega-ii-v324-1');
      return (await (await cache.match('./index.html')).text()).includes('Blackjack Omega II v3.24');
    });
    assert.equal(after,true,'Recovery must fix the HTML inside the existing release cache');
    await page.locator('#open').click();
    await page.waitForLoadState('domcontentloaded');
    assert.match(await page.title(),/v3\.24/);
    assert.deepEqual(await page.evaluate(()=>window.__OMEGA_MINI_TEST__.getState()),original.cards);
    assert.equal(await page.locator('#evSoft').inputValue(),'h17');
    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded'});
    assert.match(await page.title(),/v3\.24/);
    assert.deepEqual(await page.evaluate(()=>window.__OMEGA_MINI_TEST__.getState()),original.cards);
    assert.deepEqual(errors,[]);
    console.log('PASS Chromium update recovery: stale v3.23 HTML under v3.24 cache repaired without losing cards/rules, including offline restart');
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1});