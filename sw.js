const CACHE_NAME = 'fluxo-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });
self.addEventListener('fetch', e => {
if (e.request.method !== 'GET') return;
e.respondWith(
caches.match(e.request).then(cached => {
const fetchPromise = fetch(e.request).then(response => {
if (response && response.status === 200) {
const clone = response.clone();
caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
}
return response;
}).catch(() => cached);
return cached || fetchPromise;
})
);
});
