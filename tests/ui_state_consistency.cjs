'use strict';
const assert=require('node:assert/strict');const {boot,RULE,STATS}=require('./trainer_harness.cjs');
(async()=>{
 const old='{broken legacy shoe',store=new Map([['omega-mini-edu-v1',old],[RULE,'null']]);const env=boot({store});
 assert.equal(env.store.get('omega-mini-edu-v1'),old);assert.ok(!env.reads.includes('omega-mini-edu-v1'));
 assert.equal(env.workers.at(-1).packet.input.visible.length,3);assert.equal(env.el('storageNotice').hidden,false);
 env.complete();env.api.setTask({player:['5','6'],up:'7'});const a=env.workers.at(-1);
 env.el('evSoft').value='h17';env.el('evSoft').events.change();assert.equal(a.dead,true);
 assert.equal(env.workers.at(-1).packet.input.rules.s17,false);env.complete();
 const restored=boot({store});assert.equal(restored.el('evSoft').value,'h17');assert.equal(restored.workers.at(-1).packet.input.visible.length,3);
 const fault=boot({faults:{read:true,write:true}});fault.complete();fault.el('evSoft').value='h17';fault.el('evSoft').events.change();assert.match(fault.el('storageNotice').textContent,/сохранить/);fault.complete();assert.notEqual(fault.el('bestAction').textContent,'Нет результата');
 const memoryOnly=boot({faults:{write:true}});for(let i=0;i<2;i++){memoryOnly.api.newTask();memoryOnly.complete();memoryOnly.el('strategyAnswer').value=Object.entries(memoryOnly.api.getTask().actions).sort((a,b)=>b[1]-a[1])[0][0];await memoryOnly.api.checkAnswer();}assert.equal(memoryOnly.api.getStats().attempts,2,'failed saves must retain in-memory progress');
 const s=boot();s.complete();const action=Object.entries(s.api.getTask().actions).sort((a,b)=>b[1]-a[1])[0][0];s.el('strategyAnswer').value=action;
 await s.api.checkAnswer();await s.api.checkAnswer();assert.equal(s.api.getStats().attempts,1);assert.equal(s.api.getStats().correct,1);
 const b=boot({store:s.store});b.complete();const stale=b.workers.at(-1);const settings=JSON.parse(env.store.get(RULE));settings.evPeek='no';b.store.set(RULE,JSON.stringify(settings));b.events.storage({key:RULE,storageArea:b.storage});assert.equal(stale.dead,true);assert.equal(b.workers.at(-1).packet.input.rules.peek,false);assert.equal(b.el('strategyResult').innerHTML,'');
 b.complete();b.swEvents.controllerchange();assert.equal(b.el('appUpdateNotice').hidden,false);assert.equal(b.el('strategyResult').innerHTML,'');assert.equal(b.el('strategyNew').disabled,true);
 assert.equal(JSON.parse(s.store.get(STATS)).attempts,1);
 console.log('PASS fresh-task isolation, legacy data preservation, rule persistence/sync, storage failure, one score per task and upgrade invalidation');
})().catch(e=>{console.error(e);process.exitCode=1;});
