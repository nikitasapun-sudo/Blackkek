'use strict';
// A bounded cache must evict *memoized results*, not probabilities or paths.
// Compare the exact solver against the same finite shoe with a large cache.
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const remaining=['10','10','10','10','10','9','9','A'];
const remove=E.MAX.slice();
for(const rank of remaining)remove[E.R.indexOf(rank)]--;
const visible=[];
for(let i=0;i<remove.length;i++)for(let k=0;k<remove[i];k++)visible.push(E.R[i]);

const input={
 player:['5','5'],up:'7',visible,
 rules:{peek:false,charlieCards:0,splitAcesOneCard:true,
  dealerBJSettlement:'originalOnly',doubleAfterSplit:true},
 limitMs:20000
};
const exact=E.solveSplit(input);
assert.equal(exact.exact,true);
assert.ok(Number.isFinite(exact.ev));
let cases=0;
for(const memoLimit of [2,4,16,64]){
 const smaller=E.solveSplit({...input,memoLimit});
 assert.equal(smaller.exact,true);
 assert.ok(Math.abs(exact.ev-smaller.ev)<1e-10,
  'Evicting exact cache entries cannot change the result: '+memoLimit);
 for(const kind of ['dealer','first','second','terminal']){
  assert.ok(smaller.stats.cachePeak[kind]<=memoLimit,
   'Memory cap exceeded for '+kind+' with limit '+memoLimit);
  assert.ok(smaller.stats.cacheLimits[kind]<=memoLimit);
 }
 if(memoLimit<=4)assert.ok(Object.values(smaller.stats.cacheEvictions).some(n=>n>0),
  'Tiny caches should actually exercise evictions');
 cases++;
}
for(const invalid of [-1,0,50001,1.4,'100',null]){
 assert.throws(()=>E.solveSplit({...input,memoLimit:invalid}),/предел кэша/);
 cases++;
}
const aces={player:['A','A'],up:'7',visible:['A','A','7'],
 rules:{peek:true,s17:true,splitAcesOneCard:true},limitMs:20000};
const smallAces=E.solveSplit({...aces,memoLimit:128});
assert.ok(Math.abs(smallAces.ev-0.47241182959770595)<1e-10);
for(const kind of ['dealer','first','second','terminal'])
 assert.ok(smallAces.stats.cachePeak[kind]<=128);
cases++;
console.log('PASS bounded exact SPLIT memo cache:',cases,
 'finite-deck evictions and expected-value checks; dealer evictions',
 smallAces.stats.cacheEvictions.dealer);
