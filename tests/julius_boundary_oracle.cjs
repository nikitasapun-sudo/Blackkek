'use strict';
// Independently reasoned 1-2 unknown-card boundary values crosschecked
// with the production JavaScript from Julius's separate Python/Node harness.
// Includes natural payout, dealer peek, six/seven-card Charlie and surrender.
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const cases=[{"name":"Six-card Charlie with terminal 10 dealer","player":["2","2","2","2","2"],"up":"10","remaining":["10","10"],"rules":{"peek":false,"charlieCards":6},"expected":{"stand":-1,"hit":1}},{"name":"Same six-card hit with Charlie off","player":["2","2","2","2","2"],"up":"10","remaining":["10","10"],"rules":{"peek":false,"charlieCards":0},"expected":{"stand":-1,"hit":0}},{"name":"Peek excludes dealer natural on 6-card Charlie","player":["2","2","2","2","2"],"up":"10","remaining":["10","A"],"rules":{"peek":true,"charlieCards":6},"expected":{"stand":-1,"hit":1}},{"name":"No peek dealer natural can defeat 6-card Charlie","player":["2","2","2","2","2"],"up":"10","remaining":["10","A"],"rules":{"peek":false,"charlieCards":6},"expected":{"stand":-1,"hit":0}},{"name":"Seven-card Charlie terminal after hit","player":["A","A","2","2","2","2"],"up":"10","remaining":["10","10"],"rules":{"peek":false,"charlieCards":7},"expected":{"stand":0,"hit":1}},{"name":"Already Charlie at 6 cards","player":["A","A","2","2","2","2"],"up":"10","remaining":["10","10"],"rules":{"peek":false,"charlieCards":6},"expected":{"stand":1,"hit":null}},{"name":"Only hole remains, HIT excluded","player":["10","9"],"up":"7","remaining":["10"],"rules":{"peek":true,"charlieCards":0},"expected":{"stand":1,"hit":null}},{"name":"Natural with no peek and one remaining Ace","player":["A","10"],"up":"10","remaining":["A","10"],"rules":{"peek":false,"charlieCards":0,"blackjackPayout":1.5},"expected":{"stand":0.75,"hit":null}},{"name":"Natural after successful peek","player":["A","10"],"up":"10","remaining":["A","10"],"rules":{"peek":true,"charlieCards":0,"blackjackPayout":1.5},"expected":{"stand":1.5,"hit":null}},{"name":"Natural no peek with 6:5 payout","player":["A","10"],"up":"10","remaining":["A","10"],"rules":{"peek":false,"charlieCards":0,"blackjackPayout":1.2},"expected":{"stand":0.6,"hit":null}},{"name":"Late surrender before peek natural","player":["5","6"],"up":"10","remaining":["A","10"],"rules":{"peek":false,"charlieCards":0,"surrender":true,"surrenderTiming":"late"},"expected":{"surrender":-0.75}},{"name":"Early surrender pre peek","player":["5","6"],"up":"10","remaining":["A","10"],"rules":{"peek":false,"charlieCards":0,"surrender":true,"surrenderTiming":"early"},"expected":{"surrender":-0.5}},{"name":"Late surrender after successful peek","player":["5","6"],"up":"10","remaining":["A","10"],"rules":{"peek":true,"charlieCards":0,"surrender":true,"surrenderTiming":"late"},"expected":{"surrender":-0.5}}];
function visibleFromRemaining(remaining){
 const seen=E.MAX.slice();
 for(const card of remaining){const i=E.R.indexOf(card);assert.ok(i>=0&&seen[i]>0);seen[i]--;}
 const visible=[];
 for(let i=0;i<seen.length;i++)for(let k=0;k<seen[i];k++)visible.push(E.R[i]);
 return visible;
}
let checked=0;
for(const c of cases){
 const actual=E.solve({player:c.player,up:c.up,
  visible:visibleFromRemaining(c.remaining),rules:c.rules,limitMs:10000}).actions;
 for(const [action,expected] of Object.entries(c.expected)){
  if(expected===null)assert.equal(actual[action],undefined,c.name+': should omit '+action);
  else assert.ok(Number.isFinite(actual[action])&&Math.abs(actual[action]-expected)<1e-11,
   c.name+' '+action+' expected '+expected+' actual '+actual[action]);
  checked++;
 }
}
assert.equal(cases.length,13);assert.equal(checked,23);
console.log('PASS Julius boundary oracle: 13 end-of-shoe/Charlie/natural/surrender scenarios, 23 checks');
