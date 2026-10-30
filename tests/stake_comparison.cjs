'use strict';
const assert=require('node:assert/strict');const {html}=require('./trainer_harness.cjs');
// Stake selection was intentionally removed from the task-only product.
// Mathematical aggregate-moment scaling remains covered by variance_oracle.
for(const id of ['chipRecommendation','chipBankroll','edgeCompute','betGuide'])assert.ok(!html.includes('id="'+id+'"'));
assert.match(html,/Каждая задача начинается заново/);assert.match(html,/Результат на одну условную единицу/);
console.log('PASS task-only scope: no stake/aggregate recommendation in the eight-deck trainer');
