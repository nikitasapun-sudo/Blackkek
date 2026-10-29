'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const items=new Map();
const defaults={evSoft:'s17',evPeek:'yes',evCharlie:'6',evDAS:'no',
 evSplitAces:'one',evCharlieSplit:'no',evDoublePolicy:'any2',
 evDealerBJSettlement:'loseAll',evBJPayout:'1.5',surrenderTiming:'late',
 rulePlayer:'20',ruleDealer:'19'};
function el(id){
 if(!items.has(id))items.set(id,{
  value:defaults[id]||'no',hidden:id==='evDiagnosticText',innerHTML:'',textContent:'',
  disabled:false,children:[],dataset:{},style:{},events:{},
  addEventListener(name,fn){this.events[name]=fn;},
  append(x){this.children.push(x);},classList:{toggle(){}},querySelectorAll(){return [];},
  focus(){},select(){}
 });
 return items.get(id);
}
const workers=[];
class Worker {
 constructor(url){this.url=url;workers.push(this);}
 postMessage(data){this.input=data;}
 terminate(){this.dead=true;}
}
let copied=null,nextId=1;
const timers=new Map();
const context={
 window:{OmegaFiniteEV:E},
 document:{getElementById:el,createElement:()=>({dataset:{},addEventListener(){},classList:{toggle(){}}})},
 localStorage:{data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);}},Worker,
 setTimeout(fn,ms){const id=nextId++;timers.set(id,{fn,ms});return id;},
 clearTimeout(id){timers.delete(id);},
 navigator:{clipboard:{async writeText(value){copied=value;}}},
 console,confirm:()=>true,alert:message=>{throw Error(message);}
};
vm.runInNewContext(scripts[1][1],context,{filename:'index-inline.js'});
const test=context.window.__OMEGA_MINI_TEST__;
test.setState({
 player:['5','5'],dealer:['7'],other:['10'],history:[],
 selected:'player',surrender:false,splitPolicy:'rank'
});
test.calculateEV();
const worker=workers[0];
assert.equal(worker.url,'./omega_worker.js');
assert.equal(worker.input.mode,'all');
worker.onmessage({data:{type:'basic',value:{actions:{stand:-0.25},splitEligible:true}}});
const update={stage:'dealer-recursion',elapsedMs:12000,
 counters:{dealer:3000,transitions:8000},
 cacheSizes:{dealer:2000,first:100,second:200,terminal:300,publicDealer:400}};
worker.onmessage({data:{type:'progress',value:update}});
assert.match(el('evStatus').textContent,/dealer-recursion/);
worker.onmessage({data:{type:'error',
 message:'Лимит времени для точного SPLIT: состояние слишком сложно.',
 diagnostics:{...update,elapsedMs:22050}}});
assert.equal(worker.dead,true);
el('evDiagnosticShow').events.click();
assert.equal(el('evDiagnosticText').hidden,false);
const data=JSON.parse(el('evDiagnosticText').value);
assert.equal(data.version,'3.17');
assert.equal(data.status,'error');
assert.equal(data.stage,'dealer-recursion');
assert.equal(data.knownRemaining,412);
assert.equal(data.player.join(','),'5,5');
assert.equal(data.up,'7');
assert.equal(data.visibleCounts['10'],1);
assert.equal(data.timeoutDiagnostics.counters.dealer,3000);
assert.ok(!Object.hasOwn(data,'history'),'Do not include unrelated app history');
assert.ok(!Object.hasOwn(data,'startedAtMs'),'Do not export local wall-clock timestamp');
(async()=>{
 await el('evDiagnosticCopy').events.click();
 assert.equal(copied,el('evDiagnosticText').value);
 console.log('PASS local export: precise input, rule snapshot, progress and timeout stage; clipboard offline');
})().catch(err=>{console.error(err);process.exitCode=1});
