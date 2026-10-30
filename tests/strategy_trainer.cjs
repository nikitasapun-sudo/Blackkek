'use strict';
const assert=require('node:assert/strict');
const {boot,E}=require('./trainer_harness.cjs');
const env=boot();assert.equal(env.workers.length,1,'startup must request the hint before any answer');
assert.equal(env.workers[0].packet.mode,'single');assert.equal(env.el('strategyAnswer').value,'');
env.complete();assert.notEqual(env.el('bestAction').textContent,'Считаю…');
const scenarios=[{player:['10','6'],up:'10'},{player:['A','7'],up:'9'},{player:['5','6'],up:'6'}];
for(const s of scenarios){
 env.api.setTask(s);const packet=env.workers.at(-1).packet;
 assert.deepEqual(JSON.parse(JSON.stringify(packet.input.visible)),[...s.player,s.up]);
 assert.equal(E.numCards(E.inputCounts(packet.input)),413,'every task has a fresh eight-deck base');
 env.complete();const direct=E.chooseBestAction(E.solve(packet.input).actions);
 assert.equal(env.el('bestAction').textContent,{stand:'Остановиться',hit:'Добрать',double:'Удвоить',surrender:'Сдаться'}[direct.name]);
}
console.log('PASS trainer: automatic hint, optional answer, independent fresh eight-deck tasks and production EV');
