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
function boot(store=new Map(),faults={}){
 const elements=new Map(),workers=[],timers=new Map(),events={};
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
  window:{OmegaFiniteEV:E,addEventListener:(name,fn)=>events[name]=fn},
  document:{addEventListener(){},getElementById:el,createElement:()=>({dataset:{},addEventListener(){},classList:{toggle(){}}})},
  localStorage:{getItem:k=>{if(faults.read)throw Error('SecurityError');return store.get(k)??null;},setItem:(k,v)=>{if(faults.write===true||faults.write===k)throw Error('QuotaExceededError');store.set(k,v);}},
  Worker,console,confirm:()=>true,alert:message=>{throw Error(message);},
  setTimeout(cb,ms){timers.set(++seq,{cb,ms});return seq;},
  clearTimeout(id){timers.delete(id);}
 };
 vm.runInNewContext(script,context,{filename:'omega-ui.js'});
 return {el,workers,store,events,storage:context.localStorage,api:context.window.__OMEGA_MINI_TEST__};
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

// Storage corruption must never silently alter the mathematical shoe.
const KEY='omega-mini-edu-v1',RULE_KEY='omega-mini-edu-ev-rules-v1';
const valid=state(['5','6'],['7'],['A']);
for(const raw of ['{','null','[]','',JSON.stringify({...valid,history:undefined}),
 JSON.stringify({...valid,player:['X']}),JSON.stringify({...valid,player:[5]}),
 JSON.stringify({...valid,history:Array(33).fill('A')}),
 JSON.stringify({...valid,player:Array(22).fill('2')}),
 JSON.stringify({...valid,dealer:Array(12).fill('3')})]){
 const store=new Map([[KEY,raw]]),bad=boot(store);
 assert.equal(bad.el('storageNotice').hidden,false);
 assert.equal(bad.el('evCompute').disabled,true);
 assert.equal(store.get(KEY),raw,'Corrupt source must survive startup');
 bad.api.calculateEV();assert.equal(bad.workers.length,0);
 bad.el('next').onclick();assert.equal(store.get(KEY),raw);
 bad.el('reset').onclick();
 assert.equal(bad.el('evCompute').disabled,false);
 assert.equal(bad.el('storageNotice').hidden,true);
 assert.equal(JSON.parse(store.get(KEY)).history.length,0);
}
const repaired=boot(new Map([[KEY,JSON.stringify({...valid,selected:'__proto__',surrender:'false',splitPolicy:{},extra:'ignored'})]]));
assert.equal(repaired.api.getState().selected,'player');
assert.equal(repaired.api.getState().surrender,false);
assert.equal(repaired.api.getState().splitPolicy,'rank');
assert.equal(repaired.api.getState().extra,undefined);
assert.equal(JSON.stringify(repaired.api.getState().player),JSON.stringify(valid.player));
repaired.api.calculateEV('double');assert.equal(repaired.workers.length,1);
// Existing legacy card state may omit optional UI preferences.
const legacy=boot(new Map([[KEY,JSON.stringify({player:['5','6'],dealer:['7'],other:[],history:[]})]]));
assert.equal(legacy.api.getState().selected,'player');
assert.equal(legacy.el('storageNotice').hidden,true);
for(const raw of ['{','null','[]','5']){
 const b=boot(new Map([[KEY,JSON.stringify(valid)],[RULE_KEY,raw]]));
 assert.equal(b.el('evSoft').value,'s17');
 assert.equal(b.el('storageNotice').hidden,false);
 assert.equal(b.store.get(RULE_KEY),raw);
 assert.equal(JSON.stringify(b.api.getState().player),JSON.stringify(valid.player));
}
// A failure for rules must not be hidden by a successful card write.
const faults={write:RULE_KEY},limited=boot(new Map([[KEY,JSON.stringify(valid)]]),faults);
limited.el('evSoft').value='h17';limited.el('evSoft').events.change();
assert.match(limited.el('storageNotice').textContent,/сохранить правила/);
assert.equal(limited.el('evSoft').value,'h17');
limited.api.calculateEV('double');assert.equal(limited.workers[0].packet.input.rules.s17,false);
faults.write=false;limited.el('evSoft').events.change();
assert.equal(limited.el('storageNotice').hidden,true);
assert.equal(boot(limited.store).el('evSoft').value,'h17');
const quota={write:true},unsaved=boot(new Map(),quota);
unsaved.api.setState(valid);
assert.match(unsaved.el('storageNotice').textContent,/сохранить карты/);
assert.equal(unsaved.store.has(KEY),false);
quota.write=false;unsaved.api.setState(valid);
assert.equal(unsaved.el('storageNotice').hidden,true);
assert.equal(JSON.stringify(boot(unsaved.store).api.getState().player),JSON.stringify(valid.player));
const inaccessible=new Map([[KEY,JSON.stringify(valid)]]),denied=boot(inaccessible,{read:true});
assert.equal(denied.el('evCompute').disabled,true);
assert.match(denied.el('storageNotice').textContent,/прочитать/);
assert.equal(inaccessible.get(KEY),JSON.stringify(valid));
console.log('PASS storage: malformed/partial cards, rank counts, hand limits, safe preferences, damaged rules, read denial, per-key write failure and recovery');

// Missed or delayed storage events must not allow a stale write or calculation.
const shared=new Map([[KEY,JSON.stringify(valid)]]),tabA=boot(shared),tabB=boot(shared);
tabB.api.calculateEV('double');const pending=tabB.workers[0];
pending.onmessage({data:{type:'basic',value:{actions:{double:123},splitEligible:false}}});
tabA.api.setState({...valid,other:['A','2']});
const winner=shared.get(KEY);
tabB.el('next').onclick();
assert.equal(shared.get(KEY),winner);
assert.equal(pending.terminated,true);
assert.equal(tabB.el('evResult').innerHTML,'');
assert.equal(tabB.el('tabConflictNotice').hidden,false);
pending.onmessage({data:{type:'basic',value:{actions:{double:999}}}});
assert.equal(tabB.el('evResult').innerHTML,'');
tabB.api.calculateEV('double');assert.equal(tabB.workers.length,1);
// Unrelated and sessionStorage events are ignored, clear() invalidates.
const clean=boot(shared);
clean.events.storage({key:'other',storageArea:clean.storage});
assert.equal(clean.el('evCompute').disabled,false);
clean.events.storage({key:KEY,storageArea:{}});
assert.equal(clean.el('evCompute').disabled,false);
shared.clear();clean.events.storage({key:null,storageArea:clean.storage});
assert.equal(clean.el('evCompute').disabled,true);
assert.equal(shared.size,0);
console.log('PASS tab conflict: delayed event, stale writer/Worker, manual-only recovery, unrelated/session storage and clear');
