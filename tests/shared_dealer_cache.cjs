'use strict';
// Exact settlement must not depend on cache retention or on which split child
// produced the terminal shoe. Compare independently verified finite references.
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const remaining=['10','10','10','10','10','9','9','A'];
const counts=E.MAX.slice();
for(const r of remaining)counts[E.R.indexOf(r)]--;
const visible=[];
for(let i=0;i<E.R.length;i++)for(let j=0;j<counts[i];j++)visible.push(E.R[i]);
let checked=0;
for(const up of ['8','9','10'])
for(const peek of [true,false])
for(const settlement of ['loseAll','originalOnly'])
for(const das of [false,true]){
 const input={player:['5','5'],up,visible,limitMs:20000,
  rules:{s17:true,peek,charlieCards:0,
   dealerBJSettlement:settlement,doubleAfterSplit:das}};
 const base=E.solveSplit(input);
 const evicted=E.solveSplit({...input,memoLimit:5});
 assert.ok(Number.isFinite(base.ev));
 assert.ok(Math.abs(base.ev-evicted.ev)<1e-10,
  'Eviction changed public dealer posterior: '+JSON.stringify({up,peek,settlement,das}));
 for(const type of ['dealer','first','second','terminal','publicDealer']){
  assert.ok(evicted.stats.cachePeak[type]<=5);
 }
 assert.ok(base.stats.publicDealerHits>=0&&base.stats.publicDealerMisses>=0);
 checked++;
}
const aces=E.solveSplit({
 player:['A','A'],up:'7',visible:['A','A','7'],memoLimit:128,
 rules:{s17:true,peek:true,splitAcesOneCard:true},limitMs:20000
});
assert.ok(Math.abs(aces.ev-0.47241182959770595)<1e-10);
assert.ok(aces.stats.cachePeak.publicDealer<=128);
assert.ok(aces.stats.publicDealerMisses>0);
checked++;
console.log('PASS shared dealer posterior / exactness under heavy evictions:',checked,
 'scenarios; aces dealer cache misses:',aces.stats.publicDealerMisses);
