'use strict';
// Frozen rational reference values calculated independently in Python/Julius.
// Dealer recursion and hidden-hole enumeration live in a *separate* implementation,
// not in OmegaFiniteEV. No SPLIT or betting assumptions tested here.
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const remaining=['10','10','9','8','A','6','5'];
const counts=E.MAX.slice();
for(const r of remaining)counts[E.R.indexOf(r)]--;
const visible=[];
for(let i=0;i<E.R.length;i++)for(let j=0;j<counts[i];j++)visible.push(E.R[i]);
const groups=[
 {p:['10','7'],up:'10',st:['-17/36','-17/36','-17/36','-17/36','-23/42','-23/42','-23/42','-23/42'],db:['-53/30','-53/30','-53/30','-53/30','-58/35','-9/5','-58/35','-9/5']},
 {p:['A','7'],up:'10',st:['-5/18','-5/18','-5/18','-5/18','-8/21','-8/21','-8/21','-8/21'],db:['-2/3','-2/3','-2/3','-2/3','-5/7','-6/7','-5/7','-6/7']},
 {p:['10','6'],up:'A',st:['-109/150','-109/150','-8/15','-8/15','-169/210','-169/210','-2/3','-2/3'],db:['-197/150','-197/150','-13/10','-13/10','-257/210','-317/210','-17/14','-3/2']},
 {p:['10','3'],up:'7',st:Array(8).fill('-34/105'),db:Array(8).fill('-26/105')},
 {p:['10','6'],up:'5',st:Array(8).fill('-1/21'),db:Array(8).fill('-127/105')}
];
const rational=f=>{const [a,b='1']=f.split('/').map(Number);return a/b;};
let checked=0;
for(const g of groups){
 let k=0;
 for(const peek of [true,false])for(const s17 of [true,false])
 for(const settlement of ['originalOnly','loseAll']){
  const input={player:g.p,up:g.up,visible,rules:{peek,s17,charlieCards:0,dealerBJSettlement:settlement},limitMs:20000};
  const actual=E.solve(input).actions;
  for(const [key,reference] of [['stand',g.st[k]],['double',g.db[k]]]){
   assert.ok(Math.abs(actual[key]-rational(reference))<1e-11,
    key+' mismatch for '+JSON.stringify({player:g.p,up:g.up,peek,s17,settlement})+
    ': actual='+actual[key]+' Julius='+reference);
   checked++;
  }
  k++;
 }
}
assert.equal(checked,80);
console.log('PASS Julius independent Python rational oracle: 40 finite-shoe fixtures, 80 STAND/DOUBLE EV values');
