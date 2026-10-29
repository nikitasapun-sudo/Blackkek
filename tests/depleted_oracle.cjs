'use strict';
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js'), R=E.R;
const target={'2':3,'3':3,'4':2,'5':2,'6':2,'7':2,'8':2,'9':2,'10':9,'A':3};
const known=[];
for(let i=0;i<R.length;i++)for(let j=0;j<E.MAX[i]-target[R[i]];j++)known.push(R[i]);
function total(cards){let t=0,a=0;for(const r of cards){if(r==='A'){t+=11;a++;}else t+=Number(r);}while(t>21&&a){t-=10;a--;}return {t,soft:a>0};}
function natural(a,b){return (a==='A'&&b==='10')||(a==='10'&&b==='A');}
// Dealer receives TWO initial cards:
// This separate evaluator keeps both cards in the dealer recursion.
function dealerScore(up,hole,shoe,score,s17){
 const memo=new Map();
 function rec(hand){
  const v=total(hand);
  if(v.t>21)return 1;
  if(v.t>17||(v.t===17&&(s17||!v.soft)))return score>v.t?1:score===v.t?0:-1;
  const key=hand.slice().sort().join('.')+'|'+shoe.join('.');
  if(memo.has(key))return memo.get(key);
  const n=shoe.reduce((a,b)=>a+b,0);if(!n)throw Error('dealer cards exhausted');
  let out=0;for(let i=0;i<R.length;i++)if(shoe[i]){
   const p=shoe[i]/n;shoe[i]--;out+=p*rec([...hand,R[i]]);shoe[i]++; }
  memo.set(key,out);return out;
 }
 return rec([up,hole]);
}
function oracleStand({player,up,s17,peek}){
 const shoe=E.makeCounts(known),score=total(player).t;
 let denom=0;for(let h=0;h<R.length;h++)if(shoe[h]&&!(peek&&natural(up,R[h])))denom+=shoe[h];
 let out=0;for(let h=0;h<R.length;h++)if(shoe[h]&&!(peek&&natural(up,R[h]))){
  const p=shoe[h]/denom;shoe[h]--;
  out+=p*(natural(up,R[h])?-1:dealerScore(up,R[h],shoe,score,s17));shoe[h]++;
 }
 return out;
}
function splitOracle({up,base,peek,s17,settlement}){
 const shoe=E.makeCounts(known),n=shoe.reduce((a,b)=>a+b,0);
 let denom=0;for(let h=0;h<R.length;h++)if(shoe[h]&&!(peek&&natural(up,R[h])))denom+=shoe[h];
 let out=0;
 for(let h=0;h<R.length;h++)if(shoe[h]&&!(peek&&natural(up,R[h]))){
  const ph=shoe[h]/denom;shoe[h]--;
  let subtotal=0;
  for(let a=0;a<R.length;a++)if(shoe[a]){
   const pa=shoe[a]/(n-1);shoe[a]--;
   for(let b=0;b<R.length;b++)if(shoe[b]){
    const pb=shoe[b]/(n-2);shoe[b]--;
    let v;
    if(natural(up,R[h]))v=settlement==='originalOnly'?-1:-2;
    else v=[total([base,R[a]]).t,total([base,R[b]]).t]
      .reduce((sum,score)=>sum+(score>21?-1:dealerScore(up,R[h],shoe,score,s17)),0);
    subtotal+=pa*pb*v;shoe[b]++;
   }shoe[a]++;
  }
  out+=ph*subtotal;shoe[h]++;
 }
 return out;
}
let count=0;
for(const up of ['7','10','A'])for(const s17 of [true,false])for(const peek of [true,false]){
 const model=E.solve({player:['10','9'],up,visible:known,rules:{s17,peek,charlieCards:0}}).actions.stand;
 const exact=oracleStand({player:['10','9'],up,s17,peek});
 assert.ok(Math.abs(model-exact)<1e-11,`STAND ${up}/${s17}/${peek}: ${model} vs ${exact}`);count++;
}
for(const up of ['7','10','A'])for(const peek of [true,false])for(const settlement of ['loseAll','originalOnly']){
 const model=E.solve({player:['2','2'],up,visible:known,rules:{s17:true,peek,charlieCards:0,dealerBJSettlement:settlement}}).actions.splitTwoCardStop;
 const exact=splitOracle({up,base:'2',peek,s17:true,settlement});
 assert.ok(Math.abs(model-exact)<1e-11,`SPLIT ${up}/${peek}/${settlement}: ${model} vs ${exact}`);count++;
}
console.log('PASS independent depleted-shoe finite-shoe oracle:',count,'cases');


function oracleDouble({player,up,s17,peek,settlement}){
 const shoe=E.makeCounts(known),scoreBefore=total(player).t,n=shoe.reduce((a,b)=>a+b,0);
 assert.ok(scoreBefore<21);
 let denom=0;
 for(let h=0;h<R.length;h++)if(shoe[h]&&!(peek&&natural(up,R[h])))denom+=shoe[h];
 let ev=0;
 for(let h=0;h<R.length;h++)if(shoe[h]&&!(peek&&natural(up,R[h]))){
  const ph=shoe[h]/denom;shoe[h]--;
  for(let a=0;a<R.length;a++)if(shoe[a]){
   const pa=shoe[a]/(n-1);shoe[a]--;
   const score=total([...player,R[a]]).t;
   const payout=natural(up,R[h])
    ? (settlement==='originalOnly'?-1:-2)
    : score>21?-2:2*dealerScore(up,R[h],shoe,score,s17);
   ev+=ph*pa*payout;
   shoe[a]++;
  }
  shoe[h]++;
 }
 return ev;
}
for(const up of ['7','10','A'])for(const peek of [true,false])for(const settlement of ['loseAll','originalOnly']){
 const player=['5','6'],rules={s17:true,peek,charlieCards:0,dealerBJSettlement:settlement};
 const actual=E.solve({player,up,visible:known,rules}).actions.double;
 const expected=oracleDouble({player,up,s17:true,peek,settlement});
 assert.ok(Math.abs(actual-expected)<1e-11,`DOUBLE ${up}/${peek}/${settlement}: ${actual} vs ${expected}`);
 count++;
}
for(const up of ['7','10','A'])for(const peek of [true,false])for(const settlement of ['loseAll','originalOnly']){
 const rules={s17:true,peek,charlieCards:0,dealerBJSettlement:settlement,splitAcesOneCard:true};
 const actual=E.solveSplit({player:['A','A'],up,visible:known,rules,limitMs:12000}).ev;
 const expected=splitOracle({up,base:'A',peek,s17:true,settlement});
 assert.ok(Math.abs(actual-expected)<1e-11,`FULL SPLIT ACES ${up}/${peek}/${settlement}: ${actual} vs ${expected}`);
 count++;
}
console.log('PASS expanded depleted-shoe oracle including DOUBLE and full split aces:', count, 'cases');
