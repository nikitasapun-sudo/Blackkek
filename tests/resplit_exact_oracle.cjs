'use strict';
const assert=require('node:assert/strict');
const Core=require('../omega_v34_core.js');
const Resplit=require('../omega_v34_core.js');
function visibleFromRemaining(remaining){const visible=[];for(let i=0;i<Core.R.length;i++){const rank=Core.R[i],left=Core.MAX[i]-(remaining[rank]||0);for(let n=0;n<left;n++)visible.push(rank);}return visible;}
function input(remaining,player,up,rules={}){return {player,up,visible:visibleFromRemaining(remaining),rules:{peek:false,s17:true,charlieCards:0,...rules},limitMs:10000};}
{
 const x=input({'5':5,'9':2,'10':5,A:1},['5','5'],'10',{doubleAfterSplit:false});
 const old=Core.solveSplit(x).ev, generic=Resplit.solveResplit({...x,rules:{...x.rules,maxSplitHands:2}});
 assert.equal(generic.exact,true);assert.ok(Math.abs(generic.ev-old)<1e-12,`max-2 mismatch: ${generic.ev} vs ${old}`);
}
{
 const x=input({'8':3,'10':2,A:1},['8','8'],'10',{splitPolicy:'sameRank'});
 const noResplit=Resplit.solveResplit({...x,rules:{...x.rules,maxSplitHands:2}}).ev;
 const oneResplit=Resplit.solveResplit({...x,rules:{...x.rules,maxSplitHands:3,resplit:true}}).ev;
 assert.ok(Math.abs(noResplit+1.2)<1e-12);assert.ok(Math.abs(oneResplit+1.1833333333333331)<1e-12);assert.ok(oneResplit>noResplit);
}
{
 const x=input({'8':3,'10':2,A:1},['10','10'],'10',{splitPolicy:'sameRank',resplit:true});
 assert.throws(()=>Resplit.solveResplit(x),/10\/J\/Q\/K/);
 assert.throws(()=>Resplit.solveResplit({...x,player:['10','J'],rules:{...x.rules,resplit:false,maxSplitHands:2}}),/не образуют пару/);
 assert.throws(()=>Resplit.solveResplit({...x,visible:['10'],rules:{...x.rules,splitPolicy:'sameValue'}}),/пропущена карта/);
}
{
 const x=input({'2':8,'3':8,'4':8,'5':8,'6':8,'7':8,'8':8,'9':8,'10':8,A:8},['5','5'],'10',{maxSplitHands:4,resplit:true,limitMs:-1});
 assert.throws(()=>Resplit.solveResplit(x),/Лимит exact resplit/);
}
console.log('PASS exact resplit oracle: max-2 compatibility, one resplit gain, timeout guard');


