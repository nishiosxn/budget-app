const CACHE_NAME="budget-foyer-v25-pwa-20260930-4";
const APP_SHELL=[
  "./","./index.html","./css/style.css","./manifest.webmanifest",
  "./icons/icon.svg","./icons/favicon.ico","./icons/icon-192.png",
  "./icons/icon-512.png","./icons/apple-touch-icon.png",
  "./js/config.js","./js/data.js","./js/storage.js","./js/calculations.js","./js/ui.js",
  "./js/categories.js","./js/transactions.js","./js/settings.js","./js/tracking.js","./js/onboarding.js",
  "./js/supabase-config.js","./js/supabase-client.js","./js/auth.js","./js/cloud-household.js",
  "./js/cloud-state-core.js","./js/cloud-load.js","./js/cloud-save.js","./js/cloud-sync-v25.js",
  "./js/cloud-realtime.js","./js/pwa.js"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith("budget-foyer-v25-pwa-")&&key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  event.respondWith(
    fetch(request)
      .then(response=>{
        if(response&&response.ok){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
        }
        return response;
      })
      .catch(async()=>{
        const cached=await caches.match(request);
        if(cached)return cached;
        if(request.mode==="navigate")return caches.match("./index.html");
        throw new Error("offline");
      })
  );
});
