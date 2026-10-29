'use strict';
// Independent tiny-shoe oracle for the future aggregate second-moment path.
// It does not call the production EV or moment implementation.  Four cards
// remain before the deal: three tens and one ace.  There are no cards left
// after player and dealer receive their two initial cards, so every policy
// has a deterministic stand outcome for each ordered deal.
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');

const ranks=['10','A'];
const initial={10:3,A:1};
const outcomes=[];
function natural(hand){return hand.includes('A')&&hand.includes('10');}
function enumerate(prefix,counts,weight=1){
 if(prefix.length===4){
  const player=prefix.slice(0,2),dealer=prefix.slice(2,4);
  const playerBJ=natural(player),dealerBJ=natural(dealer);
  const payoff=playerBJ?(dealerBJ?0:1.5):(dealerBJ?-1:0);
  outcomes.push({prefix:prefix.slice(),payoff,weight});
  return;
 }
 for(const rank of ranks){
  if(!counts[rank])continue;
  const ways=counts[rank];
  counts[rank]--;
  enumerate([...prefix,rank],counts,weight*ways);
  counts[rank]++;
 }
}
enumerate([], {...initial});
const totalWeight=outcomes.reduce((sum,x)=>sum+x.weight,0);
assert.equal(totalWeight,24,'All physical ordered deals must be enumerated');

const distribution=new Map();
for(const {payoff,weight} of outcomes)distribution.set(payoff,(distribution.get(payoff)||0)+weight);
assert.equal(distribution.get(1.5),12,'Player natural against ordinary dealer');
assert.equal(distribution.get(-1),12,'Ordinary player hand against dealer natural');
assert.equal(distribution.get(0)||0,0,'No push in this tiny shoe');

const probability=totalWeight;
const mean=outcomes.reduce((sum,x)=>sum+x.weight*x.payoff,0)/probability;
const secondMoment=outcomes.reduce((sum,x)=>sum+x.weight*x.payoff*x.payoff,0)/probability;
const variance=secondMoment-mean*mean;
const sigma=Math.sqrt(variance);
assert.equal(mean,0.25);
assert.equal(secondMoment,1.625);
assert.equal(variance,1.5625);
assert.equal(sigma,1.25);

// A x2 stake scales every return by two.  Its mean doubles, while the second
// moment and variance scale by four; the standard deviation scales by two.
const doubled=outcomes.map(x=>({value:2*x.payoff,weight:x.weight}));
const mean2=doubled.reduce((sum,x)=>sum+x.weight*x.value,0)/probability;
const secondMoment2=doubled.reduce((sum,x)=>sum+x.weight*x.value*x.value,0)/probability;
const variance2=secondMoment2-mean2*mean2;
assert.equal(mean2,0.5);
assert.equal(secondMoment2,6.5);
assert.equal(variance2,6.25);
assert.equal(Math.sqrt(variance2),2.5);
assert.equal(mean2,2*mean);
assert.equal(secondMoment2,4*secondMoment);
assert.equal(variance2,4*variance);

// Compare the independently enumerated distribution to the production
// aggregate API. Known cards are the complement of the tiny shoe.
const visible=[];
for(let i=0;i<E.R.length;i++){
 const remaining=initial[E.R[i]]||0;
 for(let n=0;n<E.MAX[i]-remaining;n++)visible.push(E.R[i]);
}
for(const peek of [false,true]){
 const actual=E.compositionEdge({visible,rules:{peek,charlieCards:0},limitMs:10000});
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-11,`${a} differs from ${b}`);
 near(actual.expectedEV,mean);
 near(actual.expectedSecondMoment,secondMoment);
 near(actual.variance,variance);
 near(actual.standardDeviation,sigma);
 near(2*actual.expectedEV,mean2);
 near(4*actual.expectedSecondMoment,secondMoment2);
 near(4*actual.variance,variance2);
}

console.log('PASS independent variance oracle: tiny shoe μ=.25, M2=1.625, Var=1.5625, σ=1.25; x2 scaling verified');
