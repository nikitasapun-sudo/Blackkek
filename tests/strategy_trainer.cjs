'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');

assert.match(html,/<title>Blackjack Omega II v3\.22/);
for(const id of ['strategyNew','strategyScenario','strategyAnswer','strategyCheck','strategyResult','strategyStats','chipBankroll','chipRecommendation'])
 assert.match(html,new RegExp('id="'+id+'"'),'strategy trainer control missing: '+id);
assert.match(html,/<option value="random">Случайная задача<\/option>/);
assert.match(html,/if\(id==='random'\)/);
assert.match(html,/Подсказка показана сразу/);
assert.match(html,/const STRATEGY_STATS_KEY='omega-mini-strategy-stats-v1'/);
assert.match(html,/strategyStats\.attempts\+\+/);
assert.match(html,/strategyStats\.correct\+\+/);
assert.match(html,/strategyStats\.gap\+=gap/);
assert.match(html,/lastEdgeResult=v/);
assert.match(html,/edge>=0\.01/);
assert.match(html,/После проигрыша ставку не увеличивай/);
assert.doesNotMatch(html,/if\(!answer\)\{status\.textContent='Сначала выбери действие/);

console.log('PASS strategy trainer: random tasks, immediate hint, optional attempts and local accuracy stats');
