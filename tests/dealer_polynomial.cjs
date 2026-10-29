'use strict';
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const remaining=['10','10','10','10','10','9','9','A'];
const known=E.MAX.slice();
for(const rank of remaining)known[E.R.indexOf(rank)]--;
const visible=E.R.flatMap((rank,i)=>Array(known[i]).fill(rank));
let cases=0;
for(const player of [['5','5'],['7','7'],['10','10']])
 for(const peek of [true,false])
 for(const settlement of ['loseAll','originalOnly'])
 for(const das of [false,true]){
  const rules={s17:true,charlieCards:0,peek,splitPolicy:'sameRank',
   dealerBJSettlement:settlement,doubleAfterSplit:das};
  const input={player,up:'5',visible,limitMs:20000,rules};
  const recurse=E.solveSplit({...input,dealerPolynomial:false});
  const poly=E.solveSplit({...input,dealerPolynomial:true});
  assert.equal(poly.exact,true);
  assert.equal(poly.stats.dealerAlgorithm,'finite-polynomial');
  assert.ok(poly.stats.dealerPolynomialTerms>0);
  assert.ok(Math.abs(recurse.ev-poly.ev)<1e-10,
   'Dealer polynomial diverged from recursion: '+JSON.stringify({player,peek,settlement,das,base:recurse.ev,poly:poly.ev}));
  cases++;
 }
console.log('PASS dealer polynomial exact vs recursive dealer EV:',cases,'independent implementations; 8-card finite shoe');
