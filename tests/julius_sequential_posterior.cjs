'use strict';
// These independent exact-fraction posterior references were obtained in
// Julius by enumerating each permissible DEALER HOLE first and multiplying
// successive public-draw likelihoods under that fixed hole.
// Here we validate the mathematical count-state identity used by Omega II,
// including the excluded dealer natural after a successful peek.
// Direct engine EVs are separately checked in julius_sequential_hole_oracle.cjs.
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const cases=[["10",1,"2,2,3,5,7,8,9,10,10,10,A,A","A,2,10",["1/8","1/8","0","1/8","0","1/8","1/8","1/8","1/4","0"],["7/64","7/64","0","7/64","0","7/64","7/64","7/64","7/32","1/8"],"8/825"],["10",0,"2,2,3,5,7,8,9,10,10,10,A,A","A,2,10",["1/9","1/9","0","1/9","0","1/9","1/9","1/9","2/9","1/9"],["1/9","1/9","0","1/9","0","1/9","1/9","1/9","2/9","1/9"],"1/110"],["A",1,"2,2,3,5,7,8,9,10,10,10,A,A","10,2,A",["1/7","1/7","0","1/7","0","1/7","1/7","1/7","0","1/7"],["3/28","3/28","0","3/28","0","3/28","3/28","3/28","1/4","3/28"],"14/1485"],["A",0,"2,2,3,5,7,8,9,10,10,10,A,A","10,2,A",["1/9","1/9","0","1/9","0","1/9","1/9","1/9","2/9","1/9"],["1/9","1/9","0","1/9","0","1/9","1/9","1/9","2/9","1/9"],"1/110"],["5",1,"2,2,3,5,7,8,9,10,10,10,A,A","2,A,10",["1/9","1/9","0","1/9","0","1/9","1/9","1/9","2/9","1/9"],["1/9","1/9","0","1/9","0","1/9","1/9","1/9","2/9","1/9"],"1/110"],["A",1,"2,2,3,3,4,5,6,8,9,10,10,10,10,A,A,A","10,10,2",["1/11","2/11","1/11","1/11","1/11","0","1/11","1/11","0","3/11"],["5/66","5/33","5/66","5/66","5/66","0","5/66","5/66","1/6","5/22"],"11/1365"],["10",1,"2,2,3,3,4,5,6,8,9,10,10,10,10,A,A,A","A,3,10",["2/11","1/11","1/11","1/11","1/11","0","1/11","1/11","3/11","0"],["5/33","5/66","5/66","5/66","5/66","0","5/66","5/66","5/22","1/6"],"44/5915"],["10",0,"2,2,3,3,4,5,6,8,9,10,10,10,10,A,A,A","A,3,10",["2/13","1/13","1/13","1/13","1/13","0","1/13","1/13","3/13","2/13"],["2/13","1/13","1/13","1/13","1/13","0","1/13","1/13","3/13","2/13"],"1/140"]];
const frac=s=>{const [a,b='1']=s.split('/');return Number(a)/Number(b);};
let checked=0;
for(const [up,peek,remaining,observed,posterior,draws,likelihood] of cases){
 const initial=Array.from({length:E.R.length},(_,i)=>remaining.split(',').filter(r=>r===E.R[i]).length);
 const counts=initial.slice();
 // A third identity: the product of public conditional draw probabilities
 // must equal the hole-first exact joint observation likelihood from Julius.
 const sequential=initial.slice();
 let observedLikelihood=1;
 for(const r of observed.split(',')){
  const j=E.R.indexOf(r),n=sequential.reduce((a,b)=>a+b,0);
  const active=sequential.map((v,i)=>peek===1&&up==='10'&&E.R[i]==='A'||peek===1&&up==='A'&&E.R[i]==='10'?0:v);
  const denom=active.reduce((a,b)=>a+b,0);
  assert.ok(n>1&&denom>0&&sequential[j]>0);
  observedLikelihood*=(sequential[j]-active[j]/denom)/(n-1);
  sequential[j]--;
 }
 assert.ok(Math.abs(observedLikelihood-frac(likelihood))<1e-12,
  'Ordered public sequence likelihood failed for '+JSON.stringify({up,peek,remaining,observed}));
 checked++;
 for(const r of observed.split(',')){
  const j=E.R.indexOf(r);assert.ok(j>=0&&counts[j]>0);counts[j]--;
 }
 const isNaturalHole=i=>up==='10'&&E.R[i]==='A'||up==='A'&&E.R[i]==='10';
 const eligible=counts.map((v,i)=>v&&(peek!==1||!isNaturalHole(i))?v:0);
 const denom=eligible.reduce((a,b)=>a+b,0);
 assert.ok(denom>0);
 const remainingCount=counts.reduce((a,b)=>a+b,0);
 assert.ok(remainingCount>1);
 const calculated=eligible.map(v=>v/denom);
 let total=0,totalDraw=0;
 for(let i=0;i<E.R.length;i++){
  const w=calculated[i],draw=(counts[i]-w)/(remainingCount-1);
  assert.ok(Math.abs(w-frac(posterior[i]))<1e-12,
   'Posterior failed for '+JSON.stringify({up,peek,remaining,observed,rank:E.R[i]}));
  assert.ok(Math.abs(draw-frac(draws[i]))<1e-12,
   'Next-public-draw distribution failed for '+JSON.stringify({up,peek,remaining,observed,rank:E.R[i]}));
  assert.ok(w>=0&&w<=1);
  assert.ok(draw>=-1e-12&&draw<=1);
  total+=w;totalDraw+=draw;checked+=2;
 }
 assert.ok(Math.abs(total-1)<1e-12&&Math.abs(totalDraw-1)<1e-12);
 assert.ok(frac(likelihood)>0);
}
assert.equal(cases.length,8);
assert.equal(checked,168);
console.log('PASS hole-first conditional posterior: 8 ordered public-draw histories, 168 exact-fraction probability checks');
