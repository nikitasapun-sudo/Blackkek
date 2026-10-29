'use strict';
// Independent oracle for complete two-hand split decisions on an eight-card
// finite remainder. It does not call the model's probability or EV functions.
const assert=require('node:assert/strict');
const Model=require('../omega_v34_core.js');
const ranks=['2','3','4','5','6','7','8','9','10','A'];
const remaining=['10','10','10','10','10','9','9','A'];
const counts=Array.from({length:10},(_,i)=>remaining.filter(r=>r===ranks[i]).length);
const visible=[];
for(let i=0;i<10;i++)for(let k=counts[i];k<Model.MAX[i];k++)visible.push(ranks[i]);
const sum=a=>a.reduce((x,y)=>x+y,0);
function score(cards){
 let value=0,aces=0;
 for(const r of cards){value+=r==='A'?11:Number(r);if(r==='A')aces++;}
 while(value>21&&aces){value-=10;aces--;}return value;
}
function natural(up,hole){return(up==='10'&&hole==='A')||(up==='A'&&hole==='10');}
function oracle({up,peek,settlement,das}){
 const firstMemo=new Map(),secondMemo=new Map(),endMemo=new Map();
 const N=counts.slice();
 function weights(c){
  const w=c.map((n,j)=>peek&&natural(up,ranks[j])?0:n);
  const n=sum(w);if(n===0)throw Error('Invalid peek state');
  return w.map(v=>v/n);
 }
 function draws(c){
  const n=sum(c);if(n<=1)return [];
  const w=weights(c),out=[];
  for(let i=0;i<10;i++)if(c[i]){
   let p=0;
   for(let h=0;h<10;h++)if(w[h])p+=w[h]*(c[i]-(h===i?1:0))/(n-1);
   if(p>1e-14){const next=c.slice();next[i]--;out.push([ranks[i],p,next]);}
  }
  assert.ok(Math.abs(out.reduce((t,x)=>t+x[1],0)-1)<1e-12);
  return out;
 }
 function outcome(cards,bet,dealer){
  const t=score(cards);
  return t>21?-bet:t>dealer?bet:t<dealer?-bet:0;
 }
 function terminal(first,bet1,second,bet2,c){
  const key=first.join(',')+'|'+bet1+'|'+second.join(',')+'|'+bet2+'|'+c.join('.');
  if(endMemo.has(key))return endMemo.get(key);
  let result=0;
  const w=weights(c);
  for(let h=0;h<10;h++)if(w[h]){
   const hole=ranks[h];
   let payout;
   if(natural(up,hole))payout=!peek&&settlement==='originalOnly'?-1:-(bet1+bet2);
   else{
    const dealer=score([up,hole]);
    assert.ok(dealer>=17&&dealer<=21,'Dealer must be terminal for this finite oracle');
    payout=outcome(first,bet1,dealer)+outcome(second,bet2,dealer);
   }
   result+=w[h]*payout;
  }
  endMemo.set(key,result);return result;
 }
 function playSecond(first,bet1,second,bet2,c){
  if(score(second)>=21||sum(c)<=1)return terminal(first,bet1,second,bet2,c);
  const key=first.join(',')+'|'+bet1+'|'+second.join(',')+'|'+bet2+'|'+c.join('.');
  if(secondMemo.has(key))return secondMemo.get(key);
  let best=terminal(first,bet1,second,bet2,c),hit=0,dbl=0;
  for(const [card,p,next] of draws(c)){
   hit+=p*playSecond(first,bet1,[...second,card],bet2,next);
   if(das&&second.length===2) dbl+=p*terminal(first,bet1,[...second,card],2,next);
  }
  best=Math.max(best,hit);
  if(das&&second.length===2)best=Math.max(best,dbl);
  secondMemo.set(key,best);return best;
 }
 function startSecond(first,bet1,c){
  let result=0;
  for(const [card,p,next] of draws(c))
   result+=p*playSecond(first,bet1,['5',card],1,next);
  return result;
 }
 function playFirst(first,bet1,c){
  if(score(first)>=21||sum(c)<=2)return startSecond(first,bet1,c);
  const key=first.join(',')+'|'+bet1+'|'+c.join('.');
  if(firstMemo.has(key))return firstMemo.get(key);
  let best=startSecond(first,bet1,c),hit=0,dbl=0;
  for(const [card,p,next] of draws(c)){
   hit+=p*playFirst([...first,card],bet1,next);
   if(das&&first.length===2)dbl+=p*startSecond([...first,card],2,next);
  }
  best=Math.max(best,hit);
  if(das&&first.length===2)best=Math.max(best,dbl);
  firstMemo.set(key,best);return best;
 }
 let totalEV=0;
 for(const [card,p,next] of draws(N))totalEV+=p*playFirst(['5',card],1,next);
 return {ev:totalEV,firstStates:firstMemo.size,secondStates:secondMemo.size};
}
let cases=0;
for(const up of ['8','9','10'])for(const peek of [false,true])
for(const settlement of ['loseAll','originalOnly'])for(const das of [false,true]){
 const rules={peek, s17:true,charlieCards:0,dealerBJSettlement:settlement,
   doubleAfterSplit:das,splitAcesOneCard:true};
 const actual=Model.solveSplit({player:['5','5'],up,visible,rules,limitMs:20000});
 const independent=oracle({up,peek,settlement,das});
 assert.ok(actual.exact,'Result must be exact');
 assert.ok(Math.abs(actual.ev-independent.ev)<1e-10,
  'Independent full SPLIT mismatch: '+JSON.stringify({up,peek,settlement,das,actual:actual.ev,independent}));
 cases++;
}
console.log('PASS independent full no-resplit optimal SPLIT oracle:',cases,'information-state scenarios');
