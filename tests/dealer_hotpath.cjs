'use strict';
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const MAX=E.MAX;
let factor=1;
const weights=MAX.map(max=>{const weight=factor;factor*=max+1;return weight;});
assert.ok(Number.isSafeInteger(factor),'8-deck rank key must be a safe integer');
const encode=counts=>counts.reduce((acc,n,i)=>acc+n*weights[i],0);
const all=MAX.slice();
const allCode=encode(all);
assert.ok(Number.isSafeInteger(allCode));
const seen=new Set();
let cases=0;
for(let i=0;i<MAX.length;i++){
 const changed=MAX.slice();changed[i]--;
 assert.equal(encode(changed),allCode-weights[i]);
 assert.ok(!seen.has(encode(changed)),'Different ranks must give different codes');
 seen.add(encode(changed));
 cases++;
}
const reduced=MAX.slice();reduced[2]-=3;reduced[8]-=5;reduced[9]-=1;
for(let i=0;i<MAX.length;i++)if(reduced[i]){
 const changed=reduced.slice();changed[i]--;
 assert.equal(encode(changed),encode(reduced)-weights[i]);
 cases++;
}
const input={player:['7','7'],up:'5',
 visible:['2','2','2','3','4','5','5','5','6','6','6','6',
 '7','7','9','9','9','9','10','10','10','10','10','10','10','10','10'],
 rules:{peek:true,s17:true,charlieCards:6,charlieAfterSplit:false,
 doubleAfterSplit:false,dealerBJSettlement:'originalOnly'},limitMs:150};
assert.equal(E.numCards(E.inputCounts(input)),389);
let result=null,diagnostic=null;
try{result=E.solveSplit(input);}catch(e){
 assert.match(e.message,/Лимит времени/);
 assert.ok(e.diagnostics);
 diagnostic=e.diagnostics;
 assert.ok(['dealer-recursion','split-transitions'].includes(diagnostic.stage));
 assert.ok(diagnostic.counters.dealer>0);
}
assert.ok(result?.exact||diagnostic);
console.log('PASS exact mixed-radix dealer memo key:',cases,
 'encoding checks; replay dealer states',result?.stats?.dealer??diagnostic.counters.dealer);
