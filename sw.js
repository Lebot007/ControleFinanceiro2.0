const CACHE_NAME = 'fluxo-v9';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  /* Navegação (o HTML do app): rede primeiro, cache apenas como fallback offline.
     Assim as atualizações do site aparecem no primeiro carregamento seguinte,
     sem precisar de dois F5. */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response && response.status === 200 && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() =>
        caches.match(e.request).then(c => c || caches.match('./index.html'))
      )
    );
    return;
  }

  /* Demais recursos: stale-while-revalidate (resposta rápida + atualização em 2º plano) */
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
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
