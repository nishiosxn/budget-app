const CACHE_PREFIX="budget-foyer-v25-pwa-";

self.addEventListener("install",event=>{
 event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate",event=>{
 event.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)).map(key=>caches.delete(key))))
   .then(()=>self.clients.claim())
 );
});

self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 event.respondWith(fetch(event.request));
});

// V2.5.1 est volontairement cloud-only : le service worker ne lit ni n'écrit
// aucun cache applicatif. Les requêtes réseau échouent donc réellement hors ligne.
