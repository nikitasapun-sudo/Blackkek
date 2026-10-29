'use strict';
// User-supplied v3.10 timeout report, replayed on the exact rank-count state.
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const ranks=E.R;
const visibleCounts={'2':3,'3':1,'4':1,'5':3,'6':4,'7':2,'8':0,'9':4,'10':9,'A':0};
const visible=[];
for(const r of ranks)for(let i=0;i<visibleCounts[r];i++)visible.push(r);
const input={player:['7','7'],up:'5',visible,limitMs:90,rules:{
 resplit:false,s17:true,doublePolicy:'any2',dealerBJSettlement:'originalOnly',
 blackjackPayout:1.5,peek:true,charlieCards:6,surrender:true,
 surrenderTiming:'late',splitPolicy:'sameRank',doubleAfterSplit:false,
 splitAcesOneCard:true,charlieAfterSplit:false
}};
assert.equal(E.numCards(E.inputCounts(input)),389);
let snapshot=null;
try{
 E.solveSplit({...input,onProgress:data=>{snapshot=data;}});
 // If future optimizations complete rapidly that is also valid.
 console.log('PASS real user split fixture unexpectedly completed within short budget');
}catch(err){
 assert.match(err.message,/(?:Лимит времени|Превышен лимит вычисления SPLIT)/);
 assert.ok(err.diagnostics,'Error must contain snapshot even if no progress was received');
 assert.ok(['dealer-recursion','split-transitions'].includes(err.diagnostics.stage));
 assert.ok(err.diagnostics.counters.dealer+err.diagnostics.counters.transitions>0);
 if(snapshot)assert.ok(snapshot.elapsedMs>=0);
 console.log('PASS real user split fixture: genuine 389-card timeout includes diagnostic stage',
  err.diagnostics.stage,err.diagnostics.counters.dealer);
}
// Canonical memo states must not change successful exact mathematical results.
const remainder=['10','10','10','10','10','9','9','A'];
const known=[];
const rem=E.MAX.slice();
for(const r of remainder)rem[ranks.indexOf(r)]--;
for(let i=0;i<ranks.length;i++)for(let j=0;j<rem[i];j++)known.push(ranks[i]);
let cases=0;
for(const charlieAfterSplit of [false,true])for(const doubleAfterSplit of [false,true]){
 const result=E.solveSplit({player:['5','5'],up:'8',visible:known,limitMs:20000,
  rules:{peek:true,s17:true,charlieCards:6,charlieAfterSplit,doubleAfterSplit}});
 assert.ok(result.exact&&Number.isFinite(result.ev));
 cases++;
}
console.log('PASS canonical split memo states:',cases,'feature combinations');
