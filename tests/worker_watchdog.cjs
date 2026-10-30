'use strict';
const assert=require('node:assert/strict');const {boot}=require('./trainer_harness.cjs');
const e=boot(),old=e.workers[0];e.api.newTask();assert.equal(old.dead,true);
old.onmessage({data:{type:'basic',value:{actions:{stand:999}}}});assert.equal(e.el('strategyResult').innerHTML,'');
const worker=e.workers.at(-1),watchdog=[...e.timers.values()].find(t=>t.ms===30000);watchdog.fn();assert.equal(worker.dead,true);assert.match(e.el('strategyStatus').textContent,/лимит времени/);
worker.onmessage({data:{type:'basic',value:{actions:{stand:999}}}});assert.equal(e.el('strategyResult').innerHTML,'');
e.api.setTask({player:['8','8'],up:'10'});e.complete();e.api.calculate(true);const split=e.workers.at(-1);split.onmessage({data:{type:'error',message:'timeout'}});
assert.ok(!Number.isFinite(e.api.getTask().actions.split));assert.match(e.el('hintDetail').textContent,/Обычные действия/);assert.match(e.el('strategyStatus').textContent,/SPLIT не рассчитан/);
console.log('PASS trainer Worker lifecycle: task/rule cancellation, stale replies, deadline and explicit unavailable split');
