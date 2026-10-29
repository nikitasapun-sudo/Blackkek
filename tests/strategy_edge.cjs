'use strict';
// Independent regression checks for composition-aware strategy, count deviations,
// and pre-deal educational edge. Values are finite-shoe expectations, not stake advice.
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
function visibleWithRemaining(target){
 const visible=[];
 for(let i=0;i<E.R.length;i++){
  const left=target[E.R[i]]||0;
  for(let k=0;k<E.MAX[i]-left;k++)visible.push(E.R[i]);
 }
 return visible;
}
function near(actual,expected,tol=1e-11){assert.ok(Math.abs(actual-expected)<=tol,`${actual} differs from ${expected}`);}

// An independent small-shoe oracle enumerates initial deals in order. It keeps
// the dealer's hole card hidden while the player chooses; player-draw and
// dealer-draw probabilities are recomputed after every visible draw. This
// reference covers S17, no peek, no surrender, no Charlie, and no split.
function independentEdge(initial){
 const ranks=['8','9','10','A'],values=[8,9,10,11];
 function hand(cards){let total=0,soft=0;for(const i of cards){total+=values[i];if(i===3)soft++;while(total>21&&soft){total-=10;soft--;}}return {total,soft};}
 const isBJ=(a,b)=>(a===2&&b===3)||(a===3&&b===2);
 const sum=c=>c.reduce((a,b)=>a+b,0);
 function dealer(up,hole,c,player){
  function play(cards){
   const v=hand(cards);
   if(v.total>21)return 1;
   if(v.total>=17)return player>v.total?1:player===v.total?0:-1;
   const n=sum(c);if(!n)throw Error('reference dealer exhausted');
   let result=0;for(let i=0;i<c.length;i++)if(c[i]){const p=c[i]/n;c[i]--;result+=p*play([...cards,i]);c[i]++;}return result;
  }
  return play([up,hole]);
 }
 function stand(cards,up,c){
  const v=hand(cards);if(v.total>21)return -1;
  const n=sum(c);let result=0;
  for(let h=0;h<c.length;h++)if(c[h]){
   const p=c[h]/n;c[h]--;
   result+=p*(isBJ(up,h)?-1:dealer(up,h,c,v.total));c[h]++;
  }
  return result;
 }
 function next(cards,up,c){
  const v=hand(cards);if(v.total>21)return -1;
  let best=stand(cards,up,c);
  if(v.total<21&&sum(c)>1){
   const n=sum(c);let hit=0;
   // The hidden card is already reserved, but remains unknown. With no peek,
   // the marginal public-card probability is still c[i]/n at this state.
   for(let i=0;i<c.length;i++)if(c[i]){const p=c[i]/n;c[i]--;hit+=p*next([...cards,i],up,c);c[i]++;}
   best=Math.max(best,hit);
  }
  return best;
 }
 function initialHand(cards,up,c){
  const n=sum(c);
  if(isBJ(cards[0],cards[1])){
   let pBJ=0;for(let h=0;h<c.length;h++)if(isBJ(up,h))pBJ+=c[h]/n;
   return 1.5*(1-pBJ);
  }
  let best=next(cards,up,c),dbl=0;
  for(let i=0;i<c.length;i++)if(c[i]){const p=c[i]/n;c[i]--;dbl+=p*2*stand([...cards,i],up,c);c[i]++;}
  return Math.max(best,dbl);
 }
 const c=ranks.map(r=>initial[r]||0),n=sum(c);let result=0;
 for(let a=0;a<c.length;a++)if(c[a]){const pa=c[a]/n;c[a]--;
  for(let b=0;b<c.length;b++)if(c[b]){const pb=c[b]/(n-1);c[b]--;
   for(let u=0;u<c.length;u++)if(c[u]){const pu=c[u]/(n-2);c[u]--;
    result+=pa*pb*pu*initialHand([a,b],u,c);c[u]++;
   }c[b]++;
  }c[a]++;
 }
 return result;
}

// Omega II tags and true count are derived from the exact remaining shoe.
{
 const m=E.countingMetrics(['2','3','5','10','A']);
 assert.equal(m.remaining,411);
 assert.equal(m.runningCount,2);
 near(m.decksRemaining,411/52);
 near(m.trueCount,104/411);
}

// compareStrategy must consume a visible list that already includes the
// current player's cards and dealer upcard, without removing them twice.
{
 const visible=visibleWithRemaining({'2':30,'3':30,'4':30,'5':30,'6':30});
 const input={player:['10','6'],up:'10',visible,rules:{charlieCards:0},limitMs:10000};
 const direct=E.solve(input);
 const result=E.compareStrategy(input);
 assert.deepEqual(result.metrics,E.countingMetrics(visible));
 assert.equal(result.metrics.remaining,150);
 assert.equal(result.metrics.runningCount,-240);
 near(result.metrics.trueCount,-83.2);
 assert.equal(result.deviates,result.compositionBest.name!==result.baselineBest.name);
 for(const action of ['stand','hit','double'])near(result.currentActions[action],direct.actions[action]);
}

// Reduced finite shoe: three tens, two 9s, two 8s and one ace remain.
// All initial scenarios have enough cards for the dealer recursion. The exact
// pre-deal edge is independently pinned for both peek presentations.
{
 const visible=visibleWithRemaining({'10':3,'9':2,'8':2,'A':1});
 const reference=independentEdge({'10':3,'9':2,'8':2,'A':1});
 near(reference,0.07976190476190478);
 for(const peek of [false,true]){
  const result=E.compositionEdge({visible,rules:{peek,charlieCards:0},limitMs:10000});
  near(result.expectedEV,reference);
  near(result.playerEdge,result.expectedEV);
  near(result.houseEdge,-result.expectedEV);
  near(result.dealerBJProbability,0.10714285714285714);
  assert.equal(result.scenarios,31);
  assert.equal(result.totalScenarios,31);
  near(Object.values(result.actionWeights).reduce((a,b)=>a+b,0),1);
 }
}

// A high-card-only depleted shoe gives a simple push/loss mixture. There are
// eight ordered initial scenarios and the pre-deal edge is exactly +0.25.
{
 const visible=visibleWithRemaining({'10':3,'9':1,'A':1});
 const result=E.compositionEdge({visible,rules:{peek:false,charlieCards:0},limitMs:10000});
 near(result.expectedEV,0.25);
 near(result.dealerBJProbability,0.3);
 assert.equal(result.scenarios,8);
}

console.log('PASS composition-aware strategy, count deviations and pre-deal edge');
