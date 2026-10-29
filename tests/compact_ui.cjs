'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');

assert.match(html,/<title>Blackjack Omega II v3\.22/);
assert.match(html,/<style id="compactUi">/);
assert.match(html,/\.evsettings\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(html,/@media\(max-width:600px\)/);
assert.match(html,/<details class="disclose"><summary>Тренажёр стратегии/);
assert.match(html,/<details class="disclose"><summary>Рекомендация по виртуальным фишкам/);
assert.match(html,/<script id="omegaCore">/);

console.log('PASS compact UI contract: responsive density and collapsed optional panels without core replacement');
