/* Omega II offline module worker: static, same-origin, pre-cached.
   No external libraries, network calls or account integration. */
'use strict';
importScripts('./omega_v34_core.js');
self.onmessage=function(event){
 try{
  const packet=event.data||{},input=packet.input||packet,mode=packet.mode||'all';
  // The progress callback exists only inside the Worker, never in the cloned message.
  input.onProgress=update=>self.postMessage({type:'progress',value:update,mode});
  if(!['all','double','split'].includes(mode))throw Error('Неизвестный режим учебного расчёта');
  if(mode==='split'){
   const split=OmegaFiniteEV.solveSplit(input);
   self.postMessage({type:'split',value:split,mode});
  }else{
   const basic=OmegaFiniteEV.solve(input);
   self.postMessage({type:'basic',value:basic,mode});
   if(mode==='all'&&basic.splitEligible){
    const split=OmegaFiniteEV.solveSplit(input);
    self.postMessage({type:'split',value:split,mode});
   }
  }
  self.postMessage({type:'done',mode});
 }catch(error){
  self.postMessage({type:'error',message:error&&error.message||String(error),diagnostics:error&&error.diagnostics||null});
 }
};
