'use strict';

// Independent tiny-shoe oracle for a split with a shared dealer outcome.
// The production generic solver currently exposes only `ev`; the oracle also
// computes the aggregate second moment that a future moment API must return.
// It is important to square the sum of both hand payoffs for one dealer
// outcome.  Summing the two hand second moments would lose their covariance.
const assert=require('node:assert/strict');
const Resplit=require('../omega_v34_core.js');

function visibleFromRemaining(remaining){
 const visible=[];
 for(let i=0;i<Resplit.R.length;i++){
  const rank=Resplit.R[i];
  const known=Resplit.MAX[i]-(remaining[rank]||0);
  for(let n=0;n<known;n++)visible.push(rank);
 }
 return visible;
}

// Four cards remain after the original pair and dealer upcard are visible:
// 7, 7, 10, 10.  Split aces receive exactly one card, so no player decision
// remains.  Dealer 10+7 stands on 17 and 10+10 stands on 20.
const remaining={'7':2,'10':2};
const input={
 player:['A','A'],up:'10',visible:visibleFromRemaining(remaining),
 rules:{peek:false,s17:true,charlieCards:0,maxSplitHands:2,
   splitPolicy:'sameRank',splitAcesOneCard:true,doubleAfterSplit:false},
 limitMs:10000
};

// Enumerate physical ordered deals [dealer hole, left child, right child].
// Multiplicity in `counts` accounts for the distinct physical cards of a rank.
const outcomes=[];
function childPayoff(card,hole){
 const dealerTotal=hole==='7'?17:20;
 const playerTotal=card==='7'?18:21;
 return playerTotal>dealerTotal?1:playerTotal<dealerTotal?-1:0;
}
function enumerate(role,counts,weight,deal){
 if(role===3){
  const hole=deal[0],left=deal[1],right=deal[2];
  const payoff=childPayoff(left,hole)+childPayoff(right,hole);
  outcomes.push({hole,left,right,payoff,weight});
  return;
 }
 for(const rank of ['7','10']){
  const ways=counts[rank]||0;
  if(!ways)continue;
  counts[rank]--;
  enumerate(role+1,counts,weight*ways,[...deal,rank]);
  counts[rank]++;
 }
}
enumerate(0,{...remaining},1,[]);

const totalWeight=outcomes.reduce((sum,x)=>sum+x.weight,0);
assert.equal(totalWeight,24,'all physical ordered deals must be enumerated');
const mean=outcomes.reduce((sum,x)=>sum+x.weight*x.payoff,0)/totalWeight;
const secondMoment=outcomes.reduce((sum,x)=>sum+x.weight*x.payoff*x.payoff,0)/totalWeight;
const variance=secondMoment-mean*mean;
assert.equal(mean,2/3);
assert.equal(secondMoment,8/3);
assert.equal(variance,20/9);
assert.notEqual(secondMoment,2,'independent hand M2 would lose dealer correlation');

for(const peek of [false,true]){
 input.rules.peek=peek;
 const actual=Resplit.solveResplit(input);
 assert.equal(actual.exact,true);
 assert.ok(Math.abs(actual.ev-mean)<1e-12,`EV ${actual.ev} differs from oracle ${mean}`);

 // Keep this test forward-compatible with the moment fields.  Once generic
 // resplit returns them, the same independent oracle becomes a hard check.
 if(Object.prototype.hasOwnProperty.call(actual,'expectedSecondMoment')){
  assert.ok(Math.abs(actual.expectedSecondMoment-secondMoment)<1e-12,
    `M2 ${actual.expectedSecondMoment} differs from oracle ${secondMoment}`);
  assert.ok(Math.abs(actual.variance-variance)<1e-12,
    `variance ${actual.variance} differs from oracle ${variance}`);
 }
}

console.log('PASS independent joint-M2 split oracle: μ=2/3, M2=8/3, Var=20/9; shared dealer correlation retained');
