const CACHE = 'fluxo-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200) { const cl = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); }
      return res;
    }).catch(() => caches.match(e.request).then(m => m || caches.match('./')))
  );
});
