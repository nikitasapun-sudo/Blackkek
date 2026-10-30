'use strict';
const assert=require('node:assert/strict');const {chromium}=require('playwright');const base=process.env.OMEGA_TEST_URL||'http://127.0.0.1:8765/';
(async()=>{const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await page.evaluate(()=>{localStorage.setItem('omega-mini-edu-v1','{old broken shoe');localStorage.setItem('omega-eight-deck-rules-v1','null');});await ctx.setOffline(true);await page.reload();
 await page.waitForFunction(()=>Object.keys(window.__OMEGA_TRAINER_TEST__.getTask().actions).length>0);assert.equal(await page.locator('#storageNotice').isVisible(),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('omega-mini-edu-v1')),'{old broken shoe');assert.equal((await page.evaluate(()=>window.__OMEGA_TRAINER_TEST__.input())).visible.length,3);
 await page.locator('#rulesPanel').click();await page.evaluate(()=>{window.oldSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};});await page.locator('#evSoft').selectOption('h17');
 await page.waitForFunction(()=>document.querySelector('#storageNotice').textContent.includes('сохранить'));await page.waitForFunction(()=>Object.keys(window.__OMEGA_TRAINER_TEST__.getTask().actions).length>0);
 await page.evaluate(()=>{Storage.prototype.setItem=window.oldSetItem;});await page.locator('#evSoft').selectOption('s17');await page.reload();assert.equal(await page.locator('#evSoft').inputValue(),'s17');assert.equal(await page.locator('#storageNotice').isHidden(),true);
 assert.deepEqual(errors,[]);console.log('PASS Chromium storage: legacy shoe untouched, malformed settings recover, quota failure does not block training');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
