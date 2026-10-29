'use strict';
// Deterministic Service Worker contract test: no browser or network required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('sw.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const origin = 'https://example.test/Blackkek/';
const normalize = value => new URL(typeof value === 'string' ? value : value.url, origin).href;

const entries = new Map([
  ['omega-ii-old-release', new Map()],
  ['another-pages-project', new Map([['sample', 'must not delete']])]
]);
let networkOnline = true;
let fetchCalls = 0;
let claimed = false;
let skippedWaiting = false;
const handlers = new Map();

const caches = {
  async keys() { return [...entries.keys()]; },
  async delete(name) { return entries.delete(name); },
  async open(name) {
    if (!entries.has(name)) entries.set(name, new Map());
    const items = entries.get(name);
    return {
      async match(request) { return items.get(normalize(request)); },
      async addAll(urls) {
        if (!networkOnline) throw Error('Network unavailable during install');
        for (const url of urls) items.set(normalize(url), { source: 'cache', url: normalize(url) });
      }
    };
  },
  async match(request) {
    const key = normalize(request);
    for (const value of entries.values()) if (value.has(key)) return value.get(key);
    return undefined;
  }
};
const self = {
  location: { origin: new URL(origin).origin },
  registration: { scope: origin },
  addEventListener(name, callback) { handlers.set(name, callback); },
  skipWaiting() { skippedWaiting = true; },
  clients: { async claim() { claimed = true; } }
};
async function fetchMock(request) {
  fetchCalls++;
  if (!networkOnline) throw Error('Network offline');
  return { source: 'network', url: normalize(request) };
}
vm.runInNewContext(source, { self, caches, fetch: fetchMock, URL }, { filename: 'sw.js' });

async function lifecycle(name) {
  let promised;
  handlers.get(name)({ waitUntil(value) { promised = value; } });
  assert.ok(promised, name + ' must wait for async work');
  await promised;
}
async function request(url, method = 'GET', mode = 'cors') {
  let result,maintenance;
  handlers.get('fetch')({
    request: { url, method, mode },
    respondWith(promise) { result = promise; },
    waitUntil(promise) { maintenance = promise; }
  });
  if(result===undefined)return undefined;
  const response=await result;
  if(maintenance)await maintenance;
  return response;
}

(async () => {
  assert.ok(handlers.has('install') && handlers.has('activate') && handlers.has('fetch'));
  await lifecycle('install');
  assert.equal(skippedWaiting, true);
  const current = [...entries.keys()].find(k => k.startsWith('omega-ii-') && k !== 'omega-ii-old-release');
  assert.ok(current, 'New versioned app cache must exist');
  assert.equal(entries.get(current).size, 6, 'Six app and compute files must be precached');

  await lifecycle('activate');
  assert.equal(claimed, true);
  assert.equal(entries.has('omega-ii-old-release'), false, 'Old Omega cache must be removed');
  assert.equal(entries.has('another-pages-project'), true, 'Other app caches must stay intact');

  networkOnline = false;
  const home = await request(origin);
  const htmlCached = await request(origin + 'index.html');
  const manifest = await request(origin + 'manifest.webmanifest');
  const icon = await request(origin + 'icons/icon.svg');
  const worker = await request(origin + 'omega_worker.js');
  const core = await request(origin + 'omega_v34_core.js');
  for (const result of [home, htmlCached, manifest, icon, worker, core])
    assert.equal(result.source, 'cache', 'App shell must be available offline');
  assert.equal(fetchCalls, 0, 'Offline app-shell requests must not hit the network');
  // Query-bearing installation/update links should restart entirely from the
  // active version's precache, not fail due to a cache-key mismatch.
  // Reproduce the real update race: the previous controller recreates its
  // cache after the new release activated. A navigation must remove only
  // earlier Omega caches, never a concurrently installing *newer* release.
  entries.set('omega-ii-v314-recreated-after-activation',new Map());
  entries.set('omega-ii-v318-installing',new Map());
  const queryHome=await request(origin+'?update=317','GET','navigate');
  const queryIndex=await request(origin+'index.html?update=317','GET','navigate');
  assert.equal(entries.has('omega-ii-v314-recreated-after-activation'),false);
  assert.equal(entries.has('omega-ii-v318-installing'),true,
    'An already installing newer release must not be deleted');
  assert.equal(queryHome.url,normalize('./index.html'));
  assert.equal(queryIndex.url,normalize('./index.html'));
  assert.equal(fetchCalls,0,'Offline query navigation cannot request the network');
  // Do not silently serve the app shell for an arbitrary missing page.
  await assert.rejects(request(origin+'unrelated.html?update=317','GET','navigate'),/Network offline/);
  // Other web apps on the same origin must never receive this app's shell.
  await assert.rejects(request('https://example.test/other-app/?update=317','GET','navigate'),/Network offline/);

  const otherOrigin = await request('https://other.test/style.css');
  assert.equal(otherOrigin, undefined, 'Cross-origin traffic is not intercepted');
  const post = await request(origin + 'index.html', 'POST');
  assert.equal(post, undefined, 'POST traffic is not intercepted');

  networkOnline = true;
  assert.equal((await request(origin + 'uncached-file.txt')).source, 'network');
  assert.equal(fetchCalls, 3, 'Two intentional offline missing paths plus one online fallback');
  assert.ok(html.includes("intro=p.length+' карт без перебора: Charlie.'"),
    'Charlie label must reflect selected six/seven-card rule');

  console.log('PASS PWA: offline shell, non-destructive cache upgrade, origin/method filtering, UI label');
})().catch(error => { console.error(error); process.exitCode = 1; });
