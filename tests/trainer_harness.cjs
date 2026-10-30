'use strict';
// Lightweight DOM/Worker harness for the actual shipped trainer script.
const fs=require('node:fs'),vm=require('node:vm');
const E=require('../omega_v34_core.js');
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script id="trainerApp">([\s\S]*?)<\/script>/)[1];
const RULE='omega-eight-deck-rules-v1',STATS='omega-eight-deck-stats-v1';
function boot({store=new Map(),faults={},locks=null,protocol='https:'}={}){
 const elements=new Map(),workers=[],timers=new Map(),events={},reads=[],writes=[];let seq=0;
 function el(id){
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,options:[],events:{},addEventListener(name,fn){this.events[name]=fn;},append(x){this.options.push(x);}});
  return elements.get(id);
 }
 for(const m of html.matchAll(/<select id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
  el(m[1]).options=[...m[2].matchAll(/<option value="([^"]*)"[^>]*>(.*?)<\/option>/g)].map(x=>({value:x[1],textContent:x[2],disabled:false}));
  el(m[1]).value=el(m[1]).options[0]?.value||'';
 }
 class Worker{constructor(url){this.url=url;this.dead=false;workers.push(this);}postMessage(packet){this.packet=packet;}terminate(){this.dead=true;}}
 const storage={getItem(k){reads.push(k);if(faults.read)throw Error('read denied');return store.get(k)??null;},setItem(k,v){if(faults.write===true||faults.write===k)throw Error('quota');store.set(k,v);writes.push(k);}};
 const swEvents={};
 const navigator={locks,serviceWorker:{controller:{},addEventListener:(name,fn)=>swEvents[name]=fn}};
 const context={window:{OmegaFiniteEV:E,addEventListener:(name,fn)=>events[name]=fn},document:{getElementById:el,createElement:()=>({})},navigator,location:{protocol,hostname:'example.test',reload(){}},localStorage:storage,Worker,
 setTimeout(fn,ms){timers.set(++seq,{fn,ms});return seq;},clearTimeout(id){timers.delete(id);},console};
 vm.runInNewContext(script,context,{filename:'trainer-inline.js'});
 const api=context.window.__OMEGA_TRAINER_TEST__;
 function complete(worker=workers.at(-1),value){worker.onmessage({data:{type:'basic',value:value||E.solve(worker.packet.input)}});worker.onmessage({data:{type:'done'}});}
 return {api,el,workers,timers,events,swEvents,store,storage,reads,writes,faults,complete,context};
}
module.exports={boot,RULE,STATS,E,html};
