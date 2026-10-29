// Static same-origin PWA shell; no analytics or remote game services.
const CACHE='omega-ii-v315-1';
const RELEASE_NUMBER=315;
async function cleanEarlierReleases(){
  const keys=await caches.keys();
  for(const key of keys){
    if(!key.startsWith('omega-ii-')||key===CACHE)continue;
    const version=/^omega-ii-v(\d+)/.exec(key);
    // Do not remove a newer version that might be installing concurrently.
    if(version&&Number(version[1])>=RELEASE_NUMBER)continue;
    await caches.delete(key);
  }
}
const ASSETS=['./','./index.html','./manifest.webmanifest','./icons/icon.svg','./omega_worker.js','./omega_v34_core.js'];
self.addEventListener('install', event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event=>{
  event.waitUntil((async()=>{
    await cleanEarlierReleases();
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event=>{
  if(event.request.method!=='GET')return;
  if(new URL(event.request.url).origin!==self.location.origin)return;
  // Only the app's own entry-page navigations may ignore query parameters.
  // A link such as index.html?update=315 must work after an offline restart.
  // Do not serve index.html as a fallback for arbitrary/unknown URLs.
  const scope=new URL(self.registration.scope),path=new URL(event.request.url);
  const indexPath=new URL('./index.html',scope).pathname;
  if(event.request.mode==='navigate'&&
     (path.pathname===scope.pathname||path.pathname===indexPath)){
    event.respondWith(caches.open(CACHE).then(cache=>cache.match('./index.html'))
      .then(cached=>cached||fetch(event.request)));
    // During a live upgrade, a request still handled by the old controller
    // may recreate its cache after the new controller's activation cleanup.
    // Repair that race on the next entry navigation; keep newer releases.
    event.waitUntil?.(cleanEarlierReleases());
    return;
  }
  // Read only our versioned cache to avoid mixing two releases during updates.
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request))
    .then(cached=>cached||fetch(event.request)));
});
