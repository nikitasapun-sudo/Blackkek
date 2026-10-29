const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name)}
function close(x,y){assert.ok(Math.abs(x-y)<1e-9,`${x} differs from ${y}`)}
function actions(player,up,rules={}) {
 return E.solve({player,up,visible:[...player,up],rules,limitMs:10000}).actions;
}
test('finite 8 deck shoe',()=>assert.equal(E.numCards(E.makeCounts([])),416));
test('natural post successful peek',()=>close(actions(['A','10'],'A',{peek:true}).stand,1.5));
test('natural without peek',()=>close(actions(['A','10'],'A',{peek:false}).stand,1.0387409200968523));
test('natural alternative 6:5 payout',()=>close(actions(['A','10'],'A',{peek:true,blackjackPayout:1.2}).stand,1.2));
test('no-peek DOUBLE loses all',()=>close(actions(['5','6'],'A',{peek:false,dealerBJSettlement:'loseAll'}).double,-0.5339379694205758));
test('no-peek DOUBLE original only',()=>close(actions(['5','6'],'A',{peek:false,dealerBJSettlement:'originalOnly'}).double,-0.22401060864575748));
test('DOUBLE restricted 10-11',()=>assert.equal(actions(['4','5'],'7',{doublePolicy:'10-11'}).double,undefined));
test('DOUBLE 9-11 permits 11',()=>assert.ok(Number.isFinite(actions(['5','6'],'7',{doublePolicy:'9-11'}).double)));
test('Charlie disabled permits 6-card HIT',()=>assert.ok('hit' in actions(['2','2','2','2','2','2'],'10',{charlieCards:0})));
test('Charlie at 6 terminates',()=>assert.ok(!('hit' in actions(['2','2','2','2','2','2'],'10',{charlieCards:6}))));
test('Charlie at 7 permits six-card HIT',()=>assert.ok('hit' in actions(['2','2','2','2','2','2'],'10',{charlieCards:7})));
test('old STAND reference preserved',()=>close(actions(['10','5'],'7').stand,-0.47561837175676747));
test('old HIT reference preserved',()=>close(actions(['10','5'],'7').hit,-0.3691373204907297));
test('reject missing visible upcard',()=>assert.throws(()=>E.inputCounts({player:['10','5'],up:'7',visible:['10','5']})));
test('resplit enabled with exact hand limit',()=>{
 const rules=E.validateRules({resplit:true});
 assert.equal(rules.resplit,true);assert.equal(rules.maxSplitHands,4);
});
test('split aces no-peek OBO refund',()=>{
 const input={player:['A','A'],up:'10',visible:['A','A','10'],rules:{peek:false,splitAcesOneCard:true},limitMs:10000};
 const all=E.solveSplit(input).ev; input.rules.dealerBJSettlement='originalOnly';
 const obo=E.solveSplit(input).ev;assert.ok(obo>all);
});
console.log(`SUCCESS ${passed} checks`);
