// Static same-origin PWA shell; no analytics or remote game services.
const CACHE='omega-ii-v34-3';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icons/icon.svg'];
self.addEventListener('install', event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys()) if(key.startsWith('omega-ii-')&&key!==CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event=>{
  if(event.request.method!=='GET')return;
  if(new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
