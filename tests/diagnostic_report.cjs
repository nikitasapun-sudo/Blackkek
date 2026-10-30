'use strict';
const assert=require('node:assert/strict');const {boot}=require('./trainer_harness.cjs');
const e=boot();e.workers[0].onmessage({data:{type:'error',message:'Нет допустимых закрытых карт'}});
assert.equal(e.el('bestAction').textContent,'Нет результата');assert.equal(e.el('strategyResult').innerHTML,'');assert.match(e.el('strategyStatus').textContent,/Нет допустимых/);
e.el('surrender').value='yes';e.el('surrenderTiming').value='early';e.el('surrenderTiming').events.change();assert.equal(e.el('bestAction').textContent,'Проверь правила');assert.match(e.el('strategyStatus').textContent,/peek/);
console.log('PASS trainer failures: no numeric result on error and explicit invalid-rule explanation');
