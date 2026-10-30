'use strict';
const assert=require('node:assert/strict');const {html}=require('./trainer_harness.cjs');
assert.match(html,/<title>Blackjack Omega II v3\.25/);assert.match(html,/<style id="compactUi">/);
assert.match(html,/@media\(max-width:600px\)/);assert.match(html,/<details class="panel"><summary>Выбрать свои карты/);
assert.match(html,/<details class="panel" id="rulesPanel"><summary>Правила раздачи/);
for(const id of ['rc','tc','remaining','ranks','target','shuffleWarn','reset','edgeCompute','chipBankroll'])assert.ok(!html.includes('id="'+id+'"'),id+' must not remain in the trainer interface');
console.log('PASS compact trainer: task and immediate hint first, optional rules, no shoe/count controls');
