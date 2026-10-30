'use strict';
const assert=require('node:assert/strict');const {chromium}=require('playwright');const base=process.env.OMEGA_TEST_URL||'http://127.0.0.1:8765/';
const ready=p=>p.waitForFunction(()=>Object.keys(window.__OMEGA_TRAINER_TEST__.getTask().actions).length>0);
(async()=>{const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext(),a=await ctx.newPage(),errors=[];a.on('pageerror',e=>errors.push(e.message));await a.goto(base);await a.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await ready(a);
 const b=await ctx.newPage();b.on('pageerror',e=>errors.push(e.message));await b.goto(base);await ready(b);await ctx.setOffline(true);
 await a.evaluate(()=>window.__OMEGA_TRAINER_TEST__.setTask({player:['5','6'],up:'7'}));await b.evaluate(()=>window.__OMEGA_TRAINER_TEST__.setTask({player:['10','6'],up:'10'}));await Promise.all([ready(a),ready(b)]);
 const bTask=await b.evaluate(()=>window.__OMEGA_TRAINER_TEST__.getTask());await a.locator('#strategyNew').click();await ready(a);assert.deepEqual(await b.evaluate(()=>window.__OMEGA_TRAINER_TEST__.getTask()),bTask);
 await a.locator('#rulesPanel').click();await a.locator('#evSoft').selectOption('h17');await b.waitForFunction(()=>document.querySelector('#evSoft').value==='h17');await Promise.all([ready(a),ready(b)]);
 for(const p of [a,b])await p.evaluate(()=>{const t=window.__OMEGA_TRAINER_TEST__.getTask();document.querySelector('#strategyAnswer').value=Object.entries(t.actions).sort((x,y)=>y[1]-x[1])[0][0];});
 await Promise.all([a.evaluate(()=>window.__OMEGA_TRAINER_TEST__.checkAnswer()),b.evaluate(()=>window.__OMEGA_TRAINER_TEST__.checkAnswer())]);
 assert.equal(await a.evaluate(()=>JSON.parse(localStorage.getItem('omega-eight-deck-stats-v1')).attempts),2,'Web Locks must serialize statistics increments');
 assert.deepEqual(errors,[]);console.log('PASS Chromium tabs: independent tasks, synchronized rules, atomic simultaneous attempt counters');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
