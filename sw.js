const CACHE_NAME = 'fluxo-v2';

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
e.waitUntil(
caches.keys().then(keys =>
Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
).then(() => clients.claim())
);
});

self.addEventListener('fetch', e => {
const url = new URL(e.request.url);
// Só trata GET e http/https — ignora chrome-extension:, blob: etc.
if (e.request.method !== 'GET' || !url.protocol.startsWith('http')) return;

e.respondWith(
caches.match(e.request).then(cached => {
const fetchPromise = fetch(e.request).then(response => {
// Só cacheia respostas OK do próprio site
if (response && response.status === 200 && url.origin === self.location.origin) {
const clone = response.clone();
caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
}
return response;
}).catch(() => cached);
return cached || fetchPromise;
})
);
});
