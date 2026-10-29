'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.OMEGA_TEST_URL||'http://127.0.0.1:8765/';
const KEY='omega-mini-edu-v1';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  const raw=JSON.stringify({player:['5','6'],dealer:['7'],other:[],history:[],selected:'invalid'});
  await page.evaluate(([key,value])=>localStorage.setItem(key,value),[KEY,raw]);
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator('#storageNotice').isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>window.__OMEGA_MINI_TEST__.getState().player),['5','6']);
  await page.locator('#evDoubleCompute').click();
  await page.waitForFunction(()=>document.querySelector('#evStatus').textContent.includes('Расчёт завершён'));
  await page.evaluate(key=>localStorage.setItem(key,'{broken'),KEY);
  await page.reload();
  assert.equal(await page.locator('#evCompute').isDisabled(),true);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),'{broken');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('#reset').click();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),'{broken');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#reset').click();
  assert.equal(await page.locator('#evCompute').isEnabled(),true);
  assert.equal(await page.locator('#storageNotice').isHidden(),true);
  // Real DOM interactions must continue despite a storage quota exception.
  await page.evaluate(()=>{
   window.originalSetItem=Storage.prototype.setItem;
   Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};
  });
  await page.locator('#ranks button[data-rank="5"]').click();
  await page.locator('#evSoft').selectOption('h17');
  assert.match(await page.locator('#storageNotice').innerText(),/сохранить карты/);
  assert.match(await page.locator('#storageNotice').innerText(),/сохранить правила/);
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
  await page.locator('#evSoft').selectOption('s17');
  assert.equal(await page.locator('#storageNotice').isHidden(),true);
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>window.__OMEGA_MINI_TEST__.getState().player),['5']);
  assert.deepEqual(errors,[]);
  console.log('PASS Chromium offline storage: repaired selection, preserved corrupt record, cancel/reset, quota failure and retry');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
