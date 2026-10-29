'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const OmegaFiniteEV = require('../omega_v34_core.js');

const html = fs.readFileSync('index.html','utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length >= 3);

const defaults = {
  evSoft:'s17', evPeek:'yes', evCharlie:'6', evDAS:'no',
  evSplitAces:'one', evCharlieSplit:'no', evDoublePolicy:'any2',
  evDealerBJSettlement:'loseAll', evBJPayout:'1.5', surrenderTiming:'late',
  rulePlayer:'20', ruleDealer:'19'
};
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id,{
    value:defaults[id]||'no',innerHTML:'',textContent:'',disabled:false,hidden:false,
    children:[],dataset:{},style:{},
    classList:{toggle(){}},
    addEventListener(){},querySelectorAll(){return []},
    append(child){this.children.push(child);}
  });
  return elements.get(id);
}
const document = {
  getElementById: element,
  createElement: ()=>({
    type:'button',dataset:{},disabled:false,textContent:'',
    addEventListener(){},classList:{toggle(){}}
  })
};
let nextTimer = 1;
const timers = new Map();
function setTimeoutFake(fn,ms){const id=nextTimer++;timers.set(id,{fn,ms});return id;}
function clearTimeoutFake(id){timers.delete(id);}
function fireWatchdog(){
 const entry=[...timers.entries()].find(([,v])=>v.ms===30000);
 assert.ok(entry,'A 30-second watchdog should be armed');
 timers.delete(entry[0]);entry[1].fn();
}
const workers=[];
class Worker {
  constructor(url){this.url=url;this.terminated=false;workers.push(this);}
  postMessage(input){this.input=input;}
  terminate(){this.terminated=true;}
}
const context = {
  window:{OmegaFiniteEV}, document, Blob:class Blob {},
  Worker, URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
  localStorage:{data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);}},
  setTimeout:setTimeoutFake, clearTimeout:clearTimeoutFake,
  console, confirm:()=>true, alert:msg=>{throw Error(msg);}
};
vm.runInNewContext(scripts[1][1],context,{filename:'index-inline.js'});
const demo=context.window.__OMEGA_MINI_TEST__;
demo.setState({
  player:['10','5'],dealer:['7'],other:[],history:[],
  selected:'player',surrender:false,splitPolicy:'rank'
});

// 1. No worker response: independent main-thread timer forces cancellation.
demo.calculateEV();
assert.equal(workers.length,1);
assert.equal(workers[0].terminated,false);
assert.ok(timers.size>0);
fireWatchdog();
assert.equal(workers[0].terminated,true);
assert.equal(element('evCompute').disabled,false);
assert.equal(element('evCancel').hidden,true);
assert.match(element('evStatus').textContent,/Лимит времени ожидания/);

// 2. The basic result must not be lost if full split never completes.
demo.calculateEV();
const worker=workers[1];
worker.onmessage({data:{type:'basic',value:{
  actions:{stand:-0.25,hit:-0.15},splitEligible:true
}}});
assert.match(element('evResult').innerHTML,/0,250000|0.250000/);
fireWatchdog();
assert.equal(worker.terminated,true);
assert.match(element('evStatus').textContent,/Завершённые основные EV сохранены/);
assert.match(element('evResult').innerHTML,/0,250000|0.250000/);

// 3. Completion must release the guard and ignore events from an old worker.
demo.calculateEV();
const last=workers[2];
last.onmessage({data:{type:'done'}});
assert.equal(last.terminated,true);
assert.equal([...timers.values()].filter(t=>t.ms===30000).length,0);
const status=element('evStatus').textContent;
last.onmessage({data:{type:'error',message:'stale'}});
assert.equal(element('evStatus').textContent,status);
// 4. Split-only UI displays a distinct mathematically exact restricted result,
// retaining it when the full two-hand solver aborts. No full value is fabricated.
demo.setState({
 player:['7','7'],dealer:['5'],other:[],history:[],
 selected:'player',surrender:false,splitPolicy:'rank'
});
demo.calculateEV('split');
const splitWorker=workers[3];
assert.equal(splitWorker.input.mode,'split');
splitWorker.onmessage({data:{type:'basic',value:{
 actions:{stand:-0.2,splitTwoCardStop:-0.12345},splitEligible:true
}}});
assert.match(element('evResult').innerHTML,/одной карте \(ограниченный\)/);
assert.match(element('evResult').innerHTML,/НЕ полный SPLIT/);
assert.doesNotMatch(element('evResult').innerHTML,/SPLIT · две полные руки/);
splitWorker.onmessage({data:{type:'error',message:'Лимит времени для точного SPLIT: состояние слишком сложно.'}});
assert.equal(splitWorker.terminated,true);
assert.match(element('evStatus').textContent,/ограниченный SPLIT сохранён/);
assert.match(element('evResult').innerHTML,/НЕ полный SPLIT/);
console.log('PASS watchdog: cancellation, stale events, restricted-vs-full SPLIT distinction and timeout retention');
