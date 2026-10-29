'use strict';
// UI <-> finite-shoe mathematical consistency, settings persistence and stale
// Worker response isolation. No simulated external network or betting services.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const E=require('../omega_v34_core.js');
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)][1][1];
const defaults={evSoft:'s17',evPeek:'yes',evCharlie:'6',evDAS:'no',
 evSplitAces:'one',evCharlieSplit:'no',evDoublePolicy:'any2',
 evDealerBJSettlement:'loseAll',evBJPayout:'1.5',surrenderTiming:'late',
 rulePlayer:'20',ruleDealer:'19',evUnit:'Виртуальные учебные очки'};
function boot(store=new Map()){
 const elements=new Map(),workers=[],timers=new Map();
 let seq=0;
 function el(id){
  if(!elements.has(id))elements.set(id,{
   value:defaults[id]||'no',hidden:false,disabled:false,innerHTML:'',
   textContent:'',children:[],dataset:{},style:{},events:{},
   addEventListener(ev,cb){this.events[ev]=cb;},
   append(child){this.children.push(child);},
   classList:{toggle(){}},querySelectorAll(){return [];},
   focus(){},select(){}
  });
  return elements.get(id);
 }
 class Worker{
  constructor(url){this.url=url;workers.push(this);}
  postMessage(packet){this.packet=packet;}
  terminate(){this.terminated=true;}
 }
 const context={
  window:{OmegaFiniteEV:E},
  document:{getElementById:el,createElement:()=>({dataset:{},addEventListener(){},classList:{toggle(){}}})},
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  Worker,console,confirm:()=>true,alert:message=>{throw Error(message);},
  setTimeout(cb,ms){timers.set(++seq,{cb,ms});return seq;},
  clearTimeout(id){timers.delete(id);}
 };
 vm.runInNewContext(script,context,{filename:'omega-ui.js'});
 return {el,workers,store,api:context.window.__OMEGA_MINI_TEST__};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,a+' differs '+b);
const env=boot();
const state=(player,dealer,other=[])=>({player,dealer,other,history:[],
 selected:'player',surrender:false,splitPolicy:'rank'});
// Dealer A: successful peek means the hole cannot be ten-valued.
// Actual next public ten-valued rank: 127/412, not 127/413.
env.api.setState(state(['10','9'],['A']));
let result=env.api.stats();
near(result.ten,127/412);
near(result.bs.reduce((a,b)=>a+b.p,0),1);
assert.match(env.el('probHint').textContent,/peek/);
env.el('evPeek').value='no';env.el('evPeek').events.change();
result=env.api.stats();
near(result.ten,127/413);
near(result.bs.reduce((a,b)=>a+b.p,0),1);
// Dealer 10: after successful peek the hole cannot be an Ace.
env.api.setState(state(['9','8'],['10']));
env.el('evPeek').value='yes';env.el('evPeek').events.change();
result=env.api.stats();
near(result.bs.find(b=>b.rank==='A').p,32/412);
env.el('evPeek').value='no';env.el('evPeek').events.change();
result=env.api.stats();
near(result.bs.find(b=>b.rank==='A').p,32/413);
// On an upcard unable to form a natural, peek has no effect on probabilities.
env.api.setState(state(['10','9'],['5']));
env.el('evPeek').value='yes';env.el('evPeek').events.change();
let yes=env.api.stats().bs;
env.el('evPeek').value='no';env.el('evPeek').events.change();
let no=env.api.stats().bs;
for(let i=0;i<yes.length;i++){assert.equal(yes[i].rank,no[i].rank);near(yes[i].p,no[i].p);}
// Only one unknown card = dealer hole, never a public draw.
const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const known=ranks.flatMap(r=>Array(r==='A'?31:32).fill(r));
for(const card of ['10','9','7'])known.splice(known.indexOf(card),1);
env.api.setState(state(['10','9'],['7'],known));
result=env.api.stats();
assert.equal(result.n,1);
assert.equal(result.bs.length,0);
assert.equal(env.el('ten').textContent,'—');
assert.match(env.el('probHint').textContent,/недоступна/);
// Save allowed EV rules separately from public card state and restore offline.
env.api.setState(state(['5','6'],['10']));
for(const [id,value] of [['evPeek','no'],['evSoft','h17'],['evCharlie','7'],
 ['evBJPayout','1.2'],['evDoublePolicy','9-11']]){
 env.el(id).value=value;env.el(id).events.change();
}
env.el('surrenderTiming').value='early';
env.el('surrenderTiming').events.change();
const saved=JSON.parse(env.store.get('omega-mini-edu-ev-rules-v1'));
assert.equal(saved.evPeek,'no');assert.equal(saved.evSoft,'h17');
assert.equal(saved.surrenderTiming,'early');
const restored=boot(env.store);
for(const [id,val] of [['evPeek','no'],['evSoft','h17'],['evCharlie','7'],
 ['evBJPayout','1.2'],['evDoublePolicy','9-11'],['surrenderTiming','early']])
 assert.equal(restored.el(id).value,val,'Not restored '+id);
assert.deepEqual(JSON.stringify(restored.api.getState()),JSON.stringify(env.api.getState()));
restored.api.calculateEV('double');
assert.equal(restored.workers.length,1);
const first=restored.workers[0];
assert.equal(first.packet.input.rules.peek,false);
assert.equal(first.packet.input.rules.s17,false);
assert.equal(first.packet.input.rules.doublePolicy,'9-11');
assert.equal(first.packet.input.rules.blackjackPayout,1.2);
assert.equal(first.packet.input.rules.charlieCards,7);
assert.equal(first.packet.input.rules.surrenderTiming,'early');
// Changing a rule while computing must terminate the old Worker and clear its EV.
restored.el('evSoft').value='s17';restored.el('evSoft').events.change();
assert.equal(first.terminated,true);
first.onmessage({data:{type:'basic',value:{actions:{stand:12345},splitEligible:false}}});
assert.doesNotMatch(restored.el('evResult').innerHTML,/12345/);
restored.api.calculateEV('double');
assert.equal(restored.workers[1].packet.input.rules.s17,true);
// An invalid/tampered stored setting must not override permitted choices.
const invalid=new Map([['omega-mini-edu-ev-rules-v1',JSON.stringify({
 evPeek:'not-a-setting',evSoft:'h17',evCharlie:'99',evBJPayout:'Infinity'})]]);
const safe=boot(invalid);
assert.equal(safe.el('evPeek').value,'yes');
assert.equal(safe.el('evCharlie').value,'6');
assert.equal(safe.el('evBJPayout').value,'1.5');
assert.equal(safe.el('evSoft').value,'h17');
console.log('PASS UI / EV alignment: successful-peek conditional probabilities, exhausted-hole boundary, persisted validated rules, offline restore and stale Worker isolation');
