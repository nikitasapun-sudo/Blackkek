'use strict';
// User-reported v3.10 timeout reproduced from PUBLIC card ranks only.
// No private account data, wagers or real gaming services.
const E=require('../omega_v34_core.js');
const visibleCounts={'2':3,'3':1,'4':1,'5':3,'6':4,'7':2,'8':0,'9':4,'10':9,'A':0};
const visible=E.R.flatMap(r=>Array(visibleCounts[r]).fill(r));
const input={
 player:['7','7'],up:'5',visible,limitMs:22000,
 rules:{resplit:false,s17:true,doublePolicy:'any2',dealerBJSettlement:'loseAll',
  blackjackPayout:1.5,peek:true,charlieCards:6,surrender:true,
  surrenderTiming:'late',splitPolicy:'sameRank',doubleAfterSplit:false,
  splitAcesOneCard:true,charlieAfterSplit:false}
};
const assert=require('node:assert/strict');
const began=Date.now();
let progress=null;
try{
 const result=E.solveSplit({...input,onProgress:p=>{progress=p;}});
 assert.equal(result.exact,true);
 assert.ok(Math.abs(result.ev-(-0.0076741685158769925))<1e-10,
  'Reported 7-7 vs 5 exact finite-shoe result changed');
 assert.equal(result.stats.dealerAlgorithm,'finite-polynomial');
 console.log('REPORT_SCENARIO_COMPLETED',JSON.stringify({ms:Date.now()-began,ev:result.ev,stats:result.stats}));
}catch(err){
 console.error('REPORT_SCENARIO_FAILED',JSON.stringify({ms:Date.now()-began,message:err.message,
  diagnostics:err.diagnostics||progress}));
 throw err;
}
