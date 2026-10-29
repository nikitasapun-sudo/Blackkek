'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const E=require('../omega_v34_core.js');

const cases=[
 {
  name:'ordinary finite-shoe hard 15 against 7',
  run:()=>E.solve({
   player:['10','5'],up:'7',visible:['10','5','7'],
   rules:{s17:true,peek:true,charlieCards:6},limitMs:20000
  }),
  check:r=>assert.ok(Math.abs(r.actions.stand-(-0.47561837175676747))<1e-9)
 },
 {
  name:'split aces once, fresh eight decks',
  run:()=>E.solveSplit({
   player:['A','A'],up:'7',visible:['A','A','7'],
   rules:{s17:true,peek:true,splitAcesOneCard:true,
    doubleAfterSplit:false,charlieAfterSplit:false},limitMs:20000
  }),
  check:r=>{
   assert.equal(r.exact,true);
   assert.ok(Math.abs(r.ev-0.47241182959770595)<1e-9);
  }
 }
];
for(const test of cases){
 const t=performance.now();
 const result=test.run();
 test.check(result);
 const elapsed=performance.now()-t;
 const memory=process.memoryUsage();
 console.log(JSON.stringify({
  scenario:test.name,
  elapsedMs:Math.round(elapsed),
  rssMiB:Math.round(memory.rss/1048576),
  heapUsedMiB:Math.round(memory.heapUsed/1048576),
  states:result.stats
 }));
}
console.log('PASS performance smoke: finite outputs and resource telemetry (no fragile CPU timing threshold)');
