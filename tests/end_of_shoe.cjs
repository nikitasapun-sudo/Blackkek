'use strict';
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
function knownExcept(remaining){
 const c=E.MAX.slice();
 for(const card of remaining){const i=E.R.indexOf(card);assert.ok(i>=0&&c[i]>0);c[i]--;}
 const known=[];
 for(let i=0;i<c.length;i++)for(let j=0;j<c[i];j++)known.push(E.R[i]);
 return known;
}
function approx(actual,expected,label){
 assert.ok(Number.isFinite(actual),label+' must be finite');
 assert.ok(Math.abs(actual-expected)<1e-11,label+': '+actual+' vs '+expected);
}
let n=0;
// A single hidden 10 produces dealer 7+10=17; a player 19 may stand,
// but no additional public card can be drawn.
{
 const visible=knownExcept(['10']);
 const result=E.solve({player:['10','9'],up:'7',visible,rules:{charlieCards:0}});
 approx(result.actions.stand,1,'one-hole-card stand');
 assert.equal(result.actions.hit,undefined);
 n++;
}
// Two identical remaining tens: one is dealer's hole (20), one public.
// Player 2+3 may take one card, but cannot take an additional card after that.
{
 const visible=knownExcept(['10','10']);
 const result=E.solve({player:['2','3'],up:'10',visible,rules:{peek:false,charlieCards:0}});
 approx(result.actions.stand,-1,'two-card stand');
 approx(result.actions.hit,-1,'two-card hit');
 approx(result.actions.double,-2,'two-card double');
 n++;
}
// Exhaustive 3-card example: split 10+10 versus dealer 10.
// Hidden 7 (prob 1/3): +2. Hidden 10 (prob 2/3): -1.
// Thus (1/3)*(+2) + (2/3)*(-1) = exactly zero.
// Children have exactly two mandated cards available; there is no resplit.
for(const peek of [true,false]){
 const visible=knownExcept(['7','10','10']);
 const input={player:['10','10'],up:'10',visible,
  rules:{peek,s17:true,charlieCards:0,splitPolicy:'sameRank',doubleAfterSplit:true}};
 const basic=E.solve(input);
 const full=E.solveSplit(input);
 approx(basic.actions.splitTwoCardStop,0,'restricted split finite shoe');
 approx(full.ev,0,'full split finite shoe');
 assert.equal(full.exact,true);
 n++;
}
// No room for both split-child draws plus a hole card: explicit rejection.
{
 const visible=knownExcept(['10','10']);
 assert.throws(()=>E.solveSplit({
  player:['10','10'],up:'10',visible,rules:{charlieCards:0}
 }),/минимум две публичные карты/);
 n++;
}
console.log('PASS exhausted-shoe boundaries:',n,'independent finite outcomes');


 // Regression: a pair can stand even if fewer than three unknown cards remain.
for(const remaining of [['10'],['10','10']]){
 const result=E.solve({
  player:['10','10'],up:'10',visible:knownExcept(remaining),
  rules:{peek:false,charlieCards:0}
 });
 approx(result.actions.stand,0,'pair stand when split is impossible');
 assert.equal(result.splitEligible,false);
 assert.equal(result.actions.splitTwoCardStop,undefined);
 n++;
}
// Three cards allow the two mandatory split draws, but the dealer's
// remaining hole=2 might require a fourth card. Basic STAND must not vanish.
{
 const result=E.solve({
  player:['10','10'],up:'10',visible:knownExcept(['2','10','10']),
  rules:{peek:false,charlieCards:0}
 });
 approx(result.actions.stand,1/3,'preserved basic STAND when SPLIT cannot complete');
 assert.equal(result.splitEligible,true);
 assert.equal(result.actions.splitTwoCardStop,undefined);
 assert.match(result.splitOneCardWarning,/дилеру не хватает карт/);
 n++;
}
console.log('PASS pair split exhaustion isolation:',n,'total edge-case scenarios');
