'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const core=fs.readFileSync('omega_v34_core.js','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length>=2,'No inline scripts');
for(const [i,s] of scripts.entries())new vm.Script(s[1],{filename:'inline-'+i+'.js'});
const embedded=html.match(/<script id="omegaCore">([\s\S]*?)<\/script>/)?.[1];
assert.equal(embedded,core,'HTML and tested core must be identical');
const m=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
assert.equal(m.display,'standalone');
for(const icon of m.icons){assert.ok(fs.existsSync(icon.src),'Missing icon: '+icon.src);}
const sw=fs.readFileSync('sw.js','utf8');
new vm.Script(sw);
for(const f of ['./','./index.html','./manifest.webmanifest','./icons/icon.svg','./omega_worker.js','./omega_v34_core.js']){
 assert.ok(sw.includes("'"+f+"'"),'Cache is missing '+f);
}
assert.ok(html.includes("navigator.serviceWorker.register('./sw.js')"));
assert.ok(!html.includes('id="evResplit"'));
assert.ok(html.includes("new Worker('./omega_worker.js')"));
assert.ok(html.includes('id="evSplitCompute"') && html.includes('id="evDoubleCompute"'));
const worker=fs.readFileSync('omega_worker.js','utf8');
new vm.Script(worker);
assert.ok(worker.includes("importScripts('./omega_v34_core.js')"));
console.log('PASS: PWA manifest, service worker, inline scripts, core identity, resplit absent');
