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

// V2.5.1 est volontairement cloud-only : aucun fetch n'est servi depuis
// un cache applicatif. Le service worker reste uniquement pour l'installation PWA.
