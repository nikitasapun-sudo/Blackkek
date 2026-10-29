/* Blackjack Omega II: offline finite-shoe teaching calculation.
   All player choices use PUBLIC information only; never peek at simulated dealer hole.
   No financial/betting integrations. */
(function(root){
'use strict';
const R=['2','3','4','5','6','7','8','9','10','A'];
const MAX=[32,32,32,32,32,32,32,32,128,32];
const V=[2,3,4,5,6,7,8,9,10,11];
const K=10;
function bucket(rank){return ['J','Q','K'].includes(rank)?'10':String(rank)}
function makeCounts(visible){const c=MAX.slice();for(const rank of visible){const i=R.indexOf(bucket(rank));if(i<0||!c[i])throw Error('Недопустимый состав известных карт: '+rank);c[i]--;}return c}
function numCards(c){let n=0;for(let i=0;i<K;i++)n+=c[i];return n}
function inputCounts(input){
 if(!input||!Array.isArray(input.player)||!R.includes(bucket(input.up)))
   throw Error('Заданы не все карты игрока и открытая карта дилера');
 const required=[...input.player,input.up];
 const visible=input.visible===undefined?required:input.visible;
 if(!Array.isArray(visible))throw Error('visible должен быть массивом карт');
 const need=new Array(K).fill(0),given=new Array(K).fill(0);
 for(const rank of required){const i=R.indexOf(bucket(rank));if(i<0)throw Error('Неизвестная карта: '+rank);need[i]++;}
 for(const rank of visible){const i=R.indexOf(bucket(rank));if(i<0)throw Error('Неизвестная карта: '+rank);given[i]++;}
 for(let i=0;i<K;i++)if(given[i]<need[i])throw Error('В known/visible пропущена карта игрока или дилера: '+R[i]);
 return makeCounts(visible);
}
function validateRules(r){
 if(r?.resplit===true)throw Error('Повторный SPLIT намеренно не поддерживается');
 const rules=parseRules(r);
 if(rules.surrender&&rules.surrenderTiming==='early'&&rules.peek)
   throw Error('Ранняя сдача рассматривается ДО peek, а EV остальных действий задан ПОСЛЕ peek. Для сопоставимого учебного расчёта выбери режим без peek.');
 return rules;
}

function cardAdd(total,soft,index){total+=V[index];if(index===9)soft++;while(total>21&&soft){total-=10;soft--;}return [total,soft]}
function handValue(cards){let t=0,s=0;for(const r of cards){const i=R.indexOf(bucket(r));if(i<0)throw Error('Неизвестная карта '+r);[t,s]=cardAdd(t,s,i)}return {total:t,soft:s>0,acesSoft:s,number:cards.length,natural:cards.length===2&&t===21}}
function dealerBJ(up,hole){return (up===8&&hole===9)||(up===9&&hole===8)}
function parseRules(r={}){
 const charlieCards=r.charlieCards===0||r.charlie===false?0:(r.charlieCards??6);
 const doublePolicy=r.doublePolicy||'any2';
 const dealerBJSettlement=r.dealerBJSettlement||'loseAll';
 const blackjackPayout=r.blackjackPayout??1.5;
 if(![0,6,7].includes(charlieCards))throw Error('Charlie: 0, 6 или 7 карт');
 if(!['any2','9-11','10-11'].includes(doublePolicy))throw Error('Неизвестные ограничения DOUBLE');
 if(!['loseAll','originalOnly'].includes(dealerBJSettlement))throw Error('Неизвестный режим dealer BJ settlement');
 if(!(Number.isFinite(blackjackPayout)&&blackjackPayout>0&&blackjackPayout<=3))throw Error('Некорректная выплата blackjack');
 return {s17:r.s17!==false,charlie:charlieCards>0,charlieCards,peek:r.peek!==false,
  charlieAfterSplit:r.charlieAfterSplit===true,splitPolicy:r.splitPolicy||'sameRank',surrender:r.surrender===true,
  surrenderTiming:r.surrenderTiming==='early'?'early':'late',doubleAfterSplit:r.doubleAfterSplit===true,
  splitAcesOneCard:r.splitAcesOneCard!==false,doublePolicy,dealerBJSettlement,blackjackPayout};
}
function doubleAllowed(total,policy){return policy==='any2'||(policy==='9-11'?total>=9&&total<=11:total>=10&&total<=11)}
function solve(input){
  const start=Date.now(),rules=validateRules(input.rules),limitMs=input.limitMs??15000;
  const hand=input.player||[],up=R.indexOf(bucket(input.up)),c=inputCounts(input),hv=handValue(hand),N=numCards(c);
  if(hand.length<2||hand.length>21)throw Error('Для EV нужно от 2 до 21 карт игрока');
  if(up<0)throw Error('Выбери открытую карту дилера');
  if(N<1)throw Error('Нет неизвестной закрытой карты дилера');
  const dm=new Map(),pm=new Map(),sm=new Map();
  const stat={dealerStates:0,playerStates:0,settleStates:0,publicBranches:0};
  const dealerKey=(t,s,c)=>t+'|'+s+'|'+c.join(',');
  function dealerDist(t,s,c,n){
    if(t>21)return [1,0,0,0,0,0];
    if(t>17||(t===17&&(rules.s17||s===0)))return [0,+(t===17),+(t===18),+(t===19),+(t===20),+(t===21)];
    const key=dealerKey(t,s,c),cached=dm.get(key);if(cached)return cached;
    if(!n)throw Error('Недостаточно карт для дилера');
    const out=[0,0,0,0,0,0];
    for(let i=0;i<K;i++)if(c[i]){
      const p=c[i]/n;c[i]--;
      const [nt,ns]=cardAdd(t,s,i),a=dealerDist(nt,ns,c,n-1);
      for(let j=0;j<6;j++)out[j]+=p*a[j];
      c[i]++;
    }
    dm.set(key,out);stat.dealerStates++;if((stat.dealerStates&1023)===0&&Date.now()-start>limitMs)throw Error('Лимит времени распределения дилера; EV не подтверждён');if(dm.size>400000)throw Error('Превышен лимит кэша дилера');return out;
  }
  // P(hole=h | public cards, dealer peek result) and n unknown cards incl hole.
  function holes(c,n){
    const weights=new Array(K).fill(0);
    let M=0;
    for(let h=0;h<K;h++)if(c[h]&&!(rules.peek&&dealerBJ(up,h))){weights[h]=c[h];M+=c[h];}
    if(M===0)throw Error('Нет допустимых закрытых карт');
    for(let h=0;h<K;h++)weights[h]/=M;
    return weights;
  }
  function publicDraws(c,n){
    if(n<=1)throw Error('Недостаточно карт для добора при скрытой карте');
    const w=holes(c,n),out=[];
    for(let i=0;i<K;i++)if(c[i]){
      // Dealer hole has already been dealt, so public draws are conditional.
      const p=(c[i]-w[i])/(n-1);
      if(p>0){out.push({index:i,p});stat.publicBranches++;}
    }
    return out;
  }
  function settleForHole(t,s,len,c,n,hole,isBJ,afterSplit){
    if(t>21)return -1;
    if(isBJ)return -1; // non-natural player loses; dealer BJ beats Charlie in this ruleset.
    if(rules.charlie&&len>=rules.charlieCards&&(!afterSplit||rules.charlieAfterSplit))return 1;
    const [dt,ds]=cardAdd(...cardAdd(0,0,up),hole);
    const dist=dealerDist(dt,ds,c,n);
    let ev=dist[0];
    for(let k=17;k<=21;k++){const p=dist[k-16];ev+=p*(t>k?1:t===k?0:-1);}
    return ev;
  }
  // Information-state stand EV. Hole remains unknown; average over its posterior.
  function standEV(t,s,len,c,n,afterSplit=false){
    if(t>21)return -1;
    const key=(afterSplit?'s':'o')+'|'+t+'|'+len+'|'+c.join(',');
    const old=sm.get(key);if(old!==undefined)return old;
    let sum=0;const w=holes(c,n);
    for(let hole=0;hole<K;hole++)if(w[hole]>0){c[hole]--;
      const v=settleForHole(t,s,len,c,n-1,hole,dealerBJ(up,hole),afterSplit);
      sum+=w[hole]*v;c[hole]++;
    }
    sm.set(key,sum);stat.settleStates++;if((stat.settleStates&1023)===0&&Date.now()-start>limitMs)throw Error('Лимит времени расчёта; EV не подтверждён');return sum;
  }
  function dealerNaturalPosterior(c,n){
    const w=holes(c,n);let p=0;for(let h=0;h<K;h++)if(dealerBJ(up,h))p+=w[h];return p;
  }
  // Bellman continuation under observable information only. No double after first hit.
  function continueEV(t,s,len,c,n){
    if(t>21)return -1;
    if((len>=rules.charlieCards&&rules.charlie)||t>=21||n<=1)return standEV(t,s,len,c,n);
    const key=t+'|'+s+'|'+len+'|'+c.join(',');const found=pm.get(key);if(found!==undefined)return found;
    const stop=standEV(t,s,len,c,n);
    let hit=0;
    for(const b of publicDraws(c,n)){c[b.index]--;
      const [nt,ns]=cardAdd(t,s,b.index);
      hit+=b.p*continueEV(nt,ns,len+1,c,n-1);
      c[b.index]++;
    }
    const value=Math.max(stop,hit);
    pm.set(key,value);stat.playerStates++;
    if((stat.playerStates&1023)===0&&Date.now()-start>limitMs)throw Error('Превышено время вычисления');
    return value;
  }
  if(hv.total>21)return {actions:{stand:-1},status:'bust',stats:stat};
  if(hv.number>=rules.charlieCards&&rules.charlie)return {actions:{stand:standEV(hv.total,hv.acesSoft,hv.number,c,N)},status:'charlie',stats:stat};
  if(hv.natural){
    let pBJ=0;const ww=holes(c,N);
    // Use exactly the same conditional information state as all other actions.
    for(let h=0;h<K;h++)if(dealerBJ(up,h))pBJ+=ww[h];
    return {actions:{stand:rules.blackjackPayout*(1-pBJ)},dealerBJ:pBJ,status:'natural',stats:stat};
  }
  const actions={stand:standEV(hv.total,hv.acesSoft,hv.number,c,N)};
  if(N>1&&hv.total<21&&(!rules.charlie||hv.number<rules.charlieCards)){
    let hit=0,double=0;
    for(const b of publicDraws(c,N)){
      c[b.index]--;const [t,s]=cardAdd(hv.total,hv.acesSoft,b.index);
      hit+=b.p*continueEV(t,s,hv.number+1,c,N-1);
      if(hv.number===2&&doubleAllowed(hv.total,rules.doublePolicy)){
        const one=standEV(t,s,hv.number+1,c,N-1);
        const extra=(!rules.peek&&rules.dealerBJSettlement==='originalOnly')?dealerNaturalPosterior(c,N-1):0;
        // Original-only settlement: two units lose normally, but one is returned on dealer BJ.
        double+=b.p*(2*one+extra);
      }
      c[b.index]++;
    }
    actions.hit=hit;
    if(hv.number===2&&doubleAllowed(hv.total,rules.doublePolicy))actions.double=double;
  }
  if(rules.surrender&&hv.number===2){
    // Before peek, a late surrender loses the full unit to a dealer natural.
    // After a successful peek the main action is conditional on no dealer BJ.
    const dealerNatural=(up===9?c[8]/N:up===8?c[9]/N:0);
    actions.surrender=(rules.surrenderTiming==='late'&&!rules.peek)
      ? -0.5*(1-dealerNatural)-dealerNatural : -0.5;
  }
  // Exact joint-shoe EV for a restricted split scenario: draw 1 card to each hand, then stand.
  const [a,b]=hand.map(bucket),eligible=hv.number===2&&N>=3&&(String(hand[0])===String(hand[1])||(rules.splitPolicy==='sameValue'&&a==='10'&&b==='10'));
  let splitOneCardWarning=null;
  if(eligible){
    const child=R.indexOf(a),splitPost=(t1,s1,t2,s2,c,n)=>{
      // Same dealer path settles both split hands; compute one distribution per hole.
      let sum=0;const w=holes(c,n);
      for(let h=0;h<K;h++)if(w[h]){
        c[h]--;const bj=dealerBJ(up,h);
        sum+=w[h]*(bj&&rules.dealerBJSettlement==='originalOnly'&&!rules.peek?-1:
          settleForHole(t1,s1,2,c,n-1,h,bj,true)+settleForHole(t2,s2,2,c,n-1,h,bj,true));
        c[h]++;
      }
      return sum;
    };
    let splitEV=0;
    try{
    for(const x of publicDraws(c,N)){
      c[x.index]--;const [t1,s1]=cardAdd(...cardAdd(0,0,child),x.index);
      for(const y of publicDraws(c,N-1)){
        c[y.index]--;const [t2,s2]=cardAdd(...cardAdd(0,0,child),y.index);
        splitEV+=x.p*y.p*splitPost(t1,s1,t2,s2,c,N-2);
        c[y.index]++;
      }
      c[x.index]++;
    }
    actions.splitTwoCardStop=splitEV;
    }catch(error){
      // Some full-shoe states permit STAND, but SPLIT leaves no cards
      // for a dealer who must draw. Do not discard valid basic EVs.
      if(!/Недостаточно карт для дилера/.test(error.message))throw error;
      splitOneCardWarning='Однокарточный SPLIT не определён: дилеру не хватает карт для завершения.';
    }
  }
  return {actions,status:'ok',stats:{...stat,dealerCache:dm.size,ms:Date.now()-start},rules,splitEligible:eligible,splitOneCardWarning,splitDefinition:'Каждая часть разделённой пары получает одну карту и останавливается. Этот ограниченный сценарий рассчитан точно, но это не полный SPLIT с дальнейшими решениями.',postPeek:rules.peek,knownRemaining:N};
}
// Exact finite-shoe, two-hand, split-once educational expectation.
// No resplitting: two children draw from one shoe, dealer hole remains unobserved.
function solveSplit(input){
 const start=Date.now(), rules=validateRules(input.rules), limitMs=input.limitMs??25000;
 const hands=input.player||[], up=R.indexOf(bucket(input.up)), c=inputCounts(input), N=numCards(c);
 if(hands.length!==2||up<0)throw Error('Для SPLIT укажи пару и открытую карту дилера');
 const policy=rules.splitPolicy;
 if(!(hands[0]===hands[1]||(policy==='sameValue'&&bucket(hands[0])==='10'&&bucket(hands[1])==='10'))){throw Error('Карты не образуют пару по выбранному правилу');}
 const base=R.indexOf(bucket(hands[0]));
 if(N<3)throw Error('Для SPLIT нужны минимум две публичные карты и одна скрытая');
 const aceBase=base===9;
 const das=rules.doubleAfterSplit===true, aceOne=rules.splitAcesOneCard!==false;
 const dm=new Map(),firstMemo=new Map(),secondMemo=new Map(),terminalMemo=new Map(),publicDealerMemo=new Map(),secondStartMemo=new Map();
 // Mixed radix: rank buckets have 0..32 cards except ten-valued 0..128.
 // The complete 8-deck count vector fits uniquely into a safe JS integer.
 const countWeights=[1,33,1089,35937,1185921,39135393,1291467969,42618443077,1406408621541,181426712178789];
 function packedCounts(c){
  let code=0;
  for(let i=0;i<K;i++)code+=c[i]*countWeights[i];
  return code;
 }
 // Bound all four exact-value caches. Eviction only forces recomputation;
 // it never changes the probabilities, rewards, or Bellman recursion.
 const defaultCaps={dealer:45000,first:12000,second:30000,terminal:15000,publicDealer:22000,secondStart:12000};
 const requestedCap=input.memoLimit;
 if(requestedCap!==undefined&&(!Number.isInteger(requestedCap)||requestedCap<1||requestedCap>50000))
  throw Error('Некорректный предел кэша для учебного расчёта SPLIT');
 const cacheCaps=Object.fromEntries(Object.entries(defaultCaps).map(([kind,max])=>
  [kind,requestedCap===undefined?max:Math.min(max,requestedCap)]));
 const cacheEvictions={dealer:0,first:0,second:0,terminal:0,publicDealer:0,secondStart:0};
 const cachePeak={dealer:0,first:0,second:0,terminal:0,publicDealer:0,secondStart:0};
 function memoize(map,key,value,kind){
  if(map.size>=cacheCaps[kind]){
   map.delete(map.keys().next().value);
   cacheEvictions[kind]++;
  }
  map.set(key,value);
  if(map.size>cachePeak[kind])cachePeak[kind]=map.size;
 }
 const counters={first:0,second:0,dealer:0,terminal:0,transitions:0,publicDealerHits:0,publicDealerMisses:0};
 const reportProgress=typeof input.onProgress==='function'?input.onProgress:null;
 let lastReportMs=start;
 function diagnosticSnapshot(stage){
  return {stage,elapsedMs:Date.now()-start,counters:{...counters},
   cacheSizes:{dealer:dm.size,first:firstMemo.size,second:secondMemo.size,
    terminal:terminalMemo.size,publicDealer:publicDealerMemo.size,secondStart:secondStartMemo.size},
   cacheEvictions:{...cacheEvictions}};
 }
 function progress(stage){
  if(!reportProgress)return;
  const now=Date.now();
  if(now-lastReportMs<1000)return;
  lastReportMs=now;
  try{reportProgress(diagnosticSnapshot(stage));}catch(e){} // Diagnostics must never affect EV.
 }
 function timeout(stage,message){
  const error=Error(message);
  error.diagnostics=diagnosticSnapshot(stage);
  throw error;
 }
 function budget(){
  if((++counters.transitions&2047)!==0)return;
  progress('split-transitions');
  if(Date.now()-start>limitMs)
   timeout('split-transitions','Превышен лимит вычисления SPLIT (без точного результата). Выбери менее сложный учебный сценарий.');
 }
 function holeWeights(c,n){const w=new Array(K).fill(0);let denom=0;for(let h=0;h<K;h++)if(c[h]&&!(rules.peek&&dealerBJ(up,h))){w[h]=c[h];denom+=c[h]};if(!denom)throw Error('Нет допустимых скрытых карт');for(let h=0;h<K;h++)w[h]/=denom;return w;}
 function branches(c,n){if(n<2)throw Error('Недостаточно карт при скрытой карте');const w=holeWeights(c,n),out=[];for(let i=0;i<K;i++)if(c[i]){const p=(c[i]-w[i])/(n-1);if(p>0)out.push([i,p]);}return out;}
 function dealerDist(t,s,c,n){if(t>21)return [1,0,0,0,0,0];if(t>17||(t===17&&(rules.s17||s===0)))return [0,+(t===17),+(t===18),+(t===19),+(t===20),+(t===21)];
  const key=t+'|'+s+'|'+c.join(',');const cached=dm.get(key);if(cached){dm.delete(key);dm.set(key,cached);return cached;} if(n===0)throw Error('Дилеру не хватает карт');const out=[0,0,0,0,0,0];
  for(let i=0;i<K;i++)if(c[i]){const p=c[i]/n;c[i]--;const [nt,ns]=cardAdd(t,s,i),a=dealerDist(nt,ns,c,n-1);for(let j=0;j<6;j++)out[j]+=p*a[j];c[i]++;}
  memoize(dm,key,out,'dealer');counters.dealer++;if((counters.dealer&2047)===0){progress('dealer-recursion');if(Date.now()-start>limitMs)timeout('dealer-recursion','Лимит времени для точного SPLIT: состояние слишком сложно.');}return out;
 }

 // The upcard 5 has no possible natural dealer blackjack. Dealer drawing
 // can therefore be evaluated as one finite without-replacement sequence,
 // rather than re-solving a recursive tree independently for every terminal
 // public state. A polynomial groups ordered paths by rank multiplicity.
 // Its coefficients are integers; the runtime falling-factorial probabilities
 // are exact finite-shoe probabilities (up to normal floating-point rounding).
 const useDealerPolynomial=up===3&&rules.s17&&input.dealerPolynomial!==false;
 let dealerPaths=null,dealerFalls=null;
 function precomputeDealerPaths(){
  if(dealerPaths)return dealerPaths;
  const terminal=new Map();
  let level=[{counts:new Array(K).fill(0),t:5,s:0,ways:1}];
  for(let depth=0;depth<10&&level.length;depth++){
   const next=new Map();
   for(const node of level){
    if(node.t>21||node.t>17||node.t===17){
     const countsKey=node.counts.join(',');
     let value=terminal.get(countsKey);
     if(!value){value={ranks:node.counts.map((v,i)=>v?[i,v]:null).filter(Boolean),
      len:depth,out:new Array(6).fill(0)};terminal.set(countsKey,value);}
     const outcome=node.t>21?0:node.t-16;
     value.out[outcome]+=node.ways;
    }else{
     for(let i=0;i<K;i++){
      const counts=node.counts.slice();counts[i]++;
      const [t,soft]=cardAdd(node.t,node.s,i);
      const key=counts.join(',')+'|'+t+'|'+soft;
      let entry=next.get(key);
      if(entry)entry.ways+=node.ways;
      else next.set(key,{counts,t,s:soft,ways:node.ways});
     }
    }
   }
   level=[...next.values()];
  }
  if(level.length)throw Error('Невозможно ограничить длину последовательности дилера');
  dealerPaths=[...terminal.values()].map(entry=>({
   len:entry.len,ranks:entry.ranks,
   outcomes:entry.out.map((coefficient,bucket)=>[bucket,coefficient])
    .filter(([,coefficient])=>coefficient!==0)
  }));
  // Precompute falling factorials once, not on every terminal public state.
  dealerFalls=Array.from({length:417},(_,cards)=>{
   const result=new Float64Array(10);result[0]=1;
   for(let k=1;k<=9;k++)result[k]=k>cards?0:result[k-1]*(cards-k+1);
   return result;
  });
  return dealerPaths;
 }
 function polynomialDealerDist(c,n){
  const paths=precomputeDealerPaths(),falls=dealerFalls;
  const denominator=falls[n];
  const out=new Float64Array(6);
  for(const entry of paths){
   if(!denominator[entry.len])continue;
   let p=1/denominator[entry.len];
   for(const [i,count] of entry.ranks){
    p*=falls[c[i]][count];
    if(!p)break;
   }
   if(!p)continue;
   for(const [bucket,coefficient] of entry.outcomes)
    out[bucket]+=p*coefficient;
  }
  const total=out[0]+out[1]+out[2]+out[3]+out[4]+out[5];
  if(Math.abs(total-1)>1e-9)throw Error('Дилеру не хватает карт для точного завершения');
  return out;
 }
 // At a terminal public information state, the distribution of the dealer's
 // outcome depends only on the REMAINING cards, upcard and peek rule.
 // The two child hands share this *one* outcome distribution. Reusing it
 // across different terminal hands with identical visible shoe composition
 // avoids repeated hidden-hole enumeration without approximating anything.
 function publicDealerDistribution(c,n){
  const key=packedCounts(c);
  const known=publicDealerMemo.get(key);
  if(known!==undefined){counters.publicDealerHits++;return known;}
  if(useDealerPolynomial){
   const value={pBJ:0,dist:polynomialDealerDist(c,n)};
   memoize(publicDealerMemo,key,value,'publicDealer');
   counters.publicDealerMisses++;budget();
   return value;
  }
  const weights=holeWeights(c,n),out=new Float64Array(6);
  let pBJ=0;
  for(let h=0;h<K;h++)if(weights[h]){
   const p=weights[h];
   if(dealerBJ(up,h)){pBJ+=p;continue;}
   c[h]--;
   const [dt,ds]=cardAdd(...cardAdd(0,0,up),h);
   const d=dealerDist(dt,ds,c,n-1);
   for(let i=0;i<6;i++)out[i]+=p*d[i];
   c[h]++;
  }
  const value={pBJ,dist:out};
  memoize(publicDealerMemo,key,value,'publicDealer');
  counters.publicDealerMisses++;budget();
  return value;
 }
 // Exact expectation decomposition. Once first child has finished,
 // its expected dealer settlement is a martingale with respect to public
 // draws taken by second child. The expected sum therefore equals:
 // first child's standalone settlement + optimized second-child EV.
 // The second policy never depends on the first child's payoff, only on the
 // remaining public composition. This removes a huge duplicated state axis.
 // For originalOnly + no-peek, assign half of the one-unit dealer-natural
 // loss to each child; their sum is always exactly -1, even after DAS.
 function settleOne(t,len,bet,c,n){
  if(t>21&&(rules.peek||rules.dealerBJSettlement==='loseAll'||up!==8&&up!==9))return -bet;
  const charlie=rules.charlie&&rules.charlieAfterSplit&&len>=rules.charlieCards&&t<=21;
  if(charlie&&(rules.peek||up!==8&&up!==9))return bet;
  const key=t+'|'+(rules.charlieAfterSplit?len:0)+'|'+bet+'|'+c.join(',');
  const cached=terminalMemo.get(key);if(cached!==undefined)return cached;
  const {pBJ,dist}=publicDealerDistribution(c,n);
  const bjReturn=(!rules.peek&&rules.dealerBJSettlement==='originalOnly')? -0.5:-bet;
  let ev=pBJ*bjReturn;
  const pOther=dist[0]+dist[1]+dist[2]+dist[3]+dist[4]+dist[5];
  if(t>21)ev-=bet*pOther;
  else if(charlie)ev+=bet*pOther;
  else{
   let one=dist[0];
   for(let d=17;d<=21;d++)one+=dist[d-16]*(t>d?1:t===d?0:-1);
   ev+=bet*one;
  }
  memoize(terminalMemo,key,ev,'terminal');counters.terminal++;budget();return ev;
 }
 function playSecond(t,s,len,bet,c,n){
  if(t>=21||n<=1||(rules.charlie&&rules.charlieAfterSplit&&len>=rules.charlieCards)||(aceBase&&aceOne))
   return settleOne(t,len,bet,c,n);
  const key=t+'|'+s+'|'+(rules.charlieAfterSplit?len:Math.min(len,3))+'|'+bet+'|'+c.join(',');
  const old=secondMemo.get(key);if(old!==undefined)return old;
  let value=settleOne(t,len,bet,c,n);
  let hit=0,dbl=0;
  for(const [i,p] of branches(c,n)){
   c[i]--;const [nt,ns]=cardAdd(t,s,i);
   hit+=p*playSecond(nt,ns,len+1,bet,c,n-1);
   if(das&&len===2&&bet===1&&doubleAllowed(t,rules.doublePolicy))
    dbl+=p*settleOne(nt,len+1,2,c,n-1);
   c[i]++;
  }
  value=Math.max(value,hit);
  if(das&&len===2&&bet===1&&doubleAllowed(t,rules.doublePolicy))value=Math.max(value,dbl);
  memoize(secondMemo,key,value,'second');counters.second++;budget();return value;
 }
 function startSecond(c,n){
  const key=packedCounts(c);
  const old=secondStartMemo.get(key);if(old!==undefined)return old;
  let ev=0;
  for(const [i,p] of branches(c,n)){
   c[i]--;const [t,s]=cardAdd(...cardAdd(0,0,base),i);
   ev+=p*playSecond(t,s,2,1,c,n-1);
   c[i]++;
  }
  memoize(secondStartMemo,key,ev,'secondStart');budget();return ev;
 }
 function endFirst(t,len,bet,c,n){
  return settleOne(t,len,bet,c,n)+startSecond(c,n);
 }
 function playFirst(t,s,len,bet,c,n){
  if(t>=21||n<=2||(rules.charlie&&rules.charlieAfterSplit&&len>=rules.charlieCards)||(aceBase&&aceOne))
   return endFirst(t,len,bet,c,n);
  const key=t+'|'+s+'|'+(rules.charlieAfterSplit?len:Math.min(len,3))+'|'+bet+'|'+c.join(',');
  const old=firstMemo.get(key);if(old!==undefined)return old;
  let value=endFirst(t,len,bet,c,n);
  let hit=0,dbl=0;
  for(const [i,p] of branches(c,n)){
   c[i]--;const [nt,ns]=cardAdd(t,s,i);
   hit+=p*playFirst(nt,ns,len+1,bet,c,n-1);
   if(das&&len===2&&bet===1&&doubleAllowed(t,rules.doublePolicy))
    dbl+=p*endFirst(nt,len+1,2,c,n-1);
   c[i]++;
  }
  value=Math.max(value,hit);
  if(das&&len===2&&bet===1&&doubleAllowed(t,rules.doublePolicy))value=Math.max(value,dbl);
  memoize(firstMemo,key,value,'first');counters.first++;budget();return value;
 }
 let ev=0;
 for(const [i,p] of branches(c,N)){
   c[i]--;const [t,s]=cardAdd(...cardAdd(0,0,base),i);
   ev+=p*playFirst(t,s,2,1,c,N-1);
   c[i]++;
 }
 return {ev,rules,exact:true,assumptions:{resplit:false,afterSplitBlackjackPaysThreeToTwo:false,splitAcesOneCard:aceOne,doubleAfterSplit:das,charlieAfterSplit:rules.charlieAfterSplit},stats:{...counters,memoFirst:firstMemo.size,memoSecond:secondMemo.size,memoDealer:dm.size,cacheLimits:cacheCaps,cachePeak,cacheEvictions,publicDealerEntries:publicDealerMemo.size,secondStartEntries:secondStartMemo.size,dealerAlgorithm:useDealerPolynomial?'finite-polynomial':'recursive',dealerPolynomialTerms:dealerPaths?.length||0,ms:Date.now()-start}};
}

// Separate PRE-PEEK educational insurance experiment. Never mix with main-hand EV.
// fraction is a preset hypothetical part of one teaching unit, not a stake-size suggestion.
function insuranceScenario({up,visible=[],fraction=0.5,payout=2}={}){
 if(bucket(up)!=='A')return {available:false,reason:'Стандартный сценарий страховки предполагает открытую карту дилера A.'};
 if(!(fraction>0&&fraction<=0.5&&Number.isFinite(fraction)))throw Error('Некорректная учебная доля');
 if(!(payout>0&&Number.isFinite(payout)))throw Error('Некорректный коэффициент');
 const known=visible.length?visible:[up];
 if(!known.some(r=>bucket(r)==='A'))throw Error('Открытая карта дилера A должна входить в список известных карт');
 const counts=makeCounts(known),n=numCards(counts);
 if(!n)throw Error('Башмак пуст');
 const pBJ=counts[8]/n;
 const ifBJ=+fraction*payout;
 const ifNoBJ=-fraction;
 return {available:true,probabilityDealerBlackjack:pBJ,probabilityNoBlackjack:1-pBJ,
    insurancePayoffIfBJ:ifBJ,insurancePayoffIfNoBJ:ifNoBJ,
    expectedVirtualUnits:pBJ*ifBJ+(1-pBJ)*ifNoBJ,
    definition:'Отдельный виртуальный эксперимент ДО проверки дилером; основная рука не включена.'};
}
// Independent terminal outcome lesson, not used for stake sizing or side-bet optimization.
function terminalOutcome(player,dealer){
 const validPlayer=['bust','20','natural','charlie'];
 const validDealer=['bust','20','19','natural'];
 if(!validPlayer.includes(player)||!validDealer.includes(dealer))throw Error('Неизвестный учебный исход');
 if(player==='bust')return {kind:'loss',reason:'Перебор игрока завершает руку поражением, даже если дилер тоже превысил 21.'};
 if(dealer==='natural')return player==='natural'
  ?{kind:'push',reason:'Оба получили натуральный блэкджек: основная рука заканчивается ничьей.'}
  :{kind:'loss',reason:'Натуральный блэкджек дилера имеет приоритет перед обычной 21 и Charlie.'};
 if(player==='natural')return {kind:'win',reason:'Натуральный блэкджек игрока выигрывает, когда у дилера нет натурального блэкджека.'};
 if(player==='charlie')return {kind:'win',reason:'Six-Card Charlie выигрывает без перебора, если дилер не имеет натурального блэкджека.'};
 if(dealer==='bust')return {kind:'win',reason:'Игрок не перебрал, а дилер превысил 21.'};
 if(dealer==='20')return {kind:'push',reason:'Одинаковая обычная сумма 20: ничья.'};
 return {kind:'win',reason:'Обычная сумма игрока 20 выше суммы дилера 19.'};
}
function insuranceLesson(upcard){
 const v=bucket(upcard);
 if(v==='A')return 'При открытом тузе дилера в типовых правилах может появиться предложение страховки до проверки его закрытой карты. Если у дилера натуральный блэкджек, основная рука обычно проигрывает (кроме ничьей двух блэкджеков), а страховка учитывается отдельно. Без блэкджека дилера страховая часть не компенсируется.';
 if(v==='10')return 'При открытой карте дилера со значением 10 стандартное предложение страховки обычно отсутствует. При этом дилер всё равно может иметь натуральный блэкджек, если закрытая карта — туз.';
 return 'При открытой карте дилера, отличной от туза, стандартная страховка обычно недоступна. Она не связана с перебором игрока или дилера.';
}
const API={solve,solveSplit,doubleAllowed,makeCounts,handValue,cardAdd,MAX,R,bucket,numCards,terminalOutcome,insuranceLesson,insuranceScenario,inputCounts,validateRules,parseRules};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
root.OmegaFiniteEV=API;
})(typeof window!=='undefined'?window:globalThis);
