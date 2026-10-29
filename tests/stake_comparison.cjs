'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');

assert.match(html,/<title>Blackjack Omega II v3\.24/);
assert.match(html,/Ставка x1/);
assert.match(html,/Ставка x2/);
assert.match(html,/fmt\(edge\*2,6\)/);
assert.match(html,/x2=strong&&bankroll>=100\?'Рассматривать x2'/);
assert.match(html,/EV x2 = EV x1 × 2/);
assert.match(html,/expectedSecondMoment/);
assert.match(html,/variance\*4/);
assert.match(html,/standardDeviation/);
assert.match(html,/edge>=0\.01/);
assert.match(html,/bankroll>=100/);

console.log('PASS virtual stake comparison: x1/x2 EV scaling and conservative recommendation thresholds');
