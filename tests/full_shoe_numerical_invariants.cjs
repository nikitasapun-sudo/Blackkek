'use strict';
// Numerical invariants on large eight-deck public shoes.
// Card order must never affect a state that depends only on known rank counts.
// Test the complete public solve() output, not just helper arithmetic.
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const R=E.R;
const MAX=E.MAX;
const base=['10','7','5'];
const sizes=[3,6,27,66,129,216,303,369];
let checks=0;
for(const knownSize of sizes){
 const known=base.slice();
 const capacity=MAX.slice();
 for(const rank of base)capacity[R.indexOf(rank)]--;
 for(let k=known.length;k<knownSize;k++){
  const candidates=R.filter(rank=>capacity[R.indexOf(rank)]>0);
  const r=candidates[(k*7+Math.floor(k/3)+11)%candidates.length];
  known.push(r);capacity[R.indexOf(r)]--;
 }
 const variants=[
  known,
  known.slice().reverse(),
  [...known.slice(0,3),...known.slice(3).sort()],
  [...known.slice(0,3),...known.slice(3).sort().reverse()]
 ];
 const c=E.inputCounts({player:['10','7'],up:'5',visible:known});
 assert.equal(E.numCards(c),416-known.length);
 const inputs=variants.map(visible=>({
  player:['10','7'],up:'5',visible,
  rules:{peek:true,s17:true,charlieCards:0,blackjackPayout:1.5},
  limitMs:15000
 }));
 const ref=E.solve(inputs[0]).actions;
 for(const input of inputs.slice(1)){
  const a=E.solve(input).actions;
  assert.deepEqual(Object.keys(a).sort(),Object.keys(ref).sort());
  for(const key of Object.keys(ref)){
   assert.ok(Number.isFinite(a[key])&&Number.isFinite(ref[key]));
   assert.ok(Math.abs(a[key]-ref[key])<1e-12,
    'Visible-card permutation changes '+key+' on '+knownSize+' cards: '+a[key]+' != '+ref[key]);
   checks++;
  }
 }
 for(const k of ['stand','hit','double']){
  assert.ok(ref[k]>=-2-1e-11&&ref[k]<=2+1e-11);
 }
}
assert.ok(checks>=70);
console.log('PASS 8-deck floating-point composition invariants: '+sizes.length+
 ' shoe sizes, '+checks+' action permutation checks, finite and payout bounds');
