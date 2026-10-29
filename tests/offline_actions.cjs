'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const E=require('../omega_v34_core.js');
const code=fs.readFileSync('omega_worker.js','utf8');
const messages=[];
let imports=0;
const self={postMessage(value){messages.push(value)}};
const ctx={self,OmegaFiniteEV:E,importScripts(path){
 assert.equal(path,'./omega_v34_core.js');
 imports++;
}};
vm.runInNewContext(code,ctx,{filename:'omega_worker.js'});
assert.equal(imports,1);
function exec(mode,player,up,rules={}){
 messages.length=0;
 const input={player,up,visible:[...player,up],rules,limitMs:20000};
 self.onmessage({data:{mode,input}});
 return [...messages];
}
const ordinary=exec('all',['10','5'],'7');
assert.deepEqual(ordinary.map(x=>x.type),['basic','done']);
assert.ok(Math.abs(ordinary[0].value.actions.stand+0.47561837175676747)<1e-9);
const doubled=exec('double',['5','6'],'7');
assert.deepEqual(doubled.map(x=>x.type),['basic','done']);
assert.ok(Number.isFinite(doubled[0].value.actions.double));
const split=exec('split',['A','A'],'7',{splitAcesOneCard:true});
assert.deepEqual(split.map(x=>x.type),['basic','split','done']);
assert.ok(Number.isFinite(split[0].value.actions.splitTwoCardStop),'Restricted split must complete before full split');
assert.ok(Math.abs(split[1].value.ev-0.47241182959770595)<1e-9);
assert.equal(split[1].value.exact,true);
const both=exec('all',['A','A'],'7',{splitAcesOneCard:true});
assert.deepEqual(both.map(x=>x.type),['basic','split','done']);
assert.ok(Math.abs(both[1].value.ev-split[1].value.ev)<1e-12);
const invalid=exec('split',['9','8'],'7');
assert.equal(invalid.length,1);
assert.equal(invalid[0].type,'error');
assert.ok(!messages.some(x=>x.type==='done'));
assert.ok(!code.includes('fetch('),'Worker must not require internet');
// Force the exact full solver to time out after a valid restricted result.
// The Worker must not forge a full SPLIT value or a successful completion.
const timeoutMessages=[];
const simulatedEngine={
 solve(){return {actions:{splitTwoCardStop:-0.12345},splitEligible:true};},
 solveSplit(){
  const err=Error('Лимит времени для точного SPLIT: состояние слишком сложно.');
  err.diagnostics={stage:'dealer-recursion',elapsedMs:22000,counters:{dealer:10000}};
  throw err;
 }
};
const timeoutSelf={postMessage(value){timeoutMessages.push(value);}};
vm.runInNewContext(code,{self:timeoutSelf,OmegaFiniteEV:simulatedEngine,
 importScripts(path){assert.equal(path,'./omega_v34_core.js');}},{filename:'omega_worker_timeout.js'});
timeoutSelf.onmessage({data:{mode:'split',input:{player:['7','7'],up:'5'}}});
assert.deepEqual(timeoutMessages.map(x=>x.type),['basic','error']);
assert.equal(timeoutMessages[0].value.actions.splitTwoCardStop,-0.12345);
assert.equal(timeoutMessages[1].diagnostics.stage,'dealer-recursion');
assert.ok(timeoutMessages.every(x=>x.type!=='split'&&x.type!=='done'),
 'A timed-out full split must not be misrepresented as exact');
console.log('PASS static offline Worker: ordinary, double, restricted split before full, timeout preservation and no network');
