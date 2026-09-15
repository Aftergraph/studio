const CACHE = 'aftergraph-billing-shell-v2';
const SHELL = [
  '/billing/',
  '/billing/manifest.webmanifest',
  '/billing/icons/icon-192.svg',
  '/billing/icons/icon-512.svg',
  '/styles/tokens.css',
  '/styles/reset.css',
  '/styles/billing.css',
  '/src/billing/pwa.mjs',
  '/src/billing/billing-app.mjs',
  '/src/billing/browser-client.mjs',
  '/src/billing/app-state.mjs',
  '/src/billing/money.mjs'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Financial mutations are always online-only. They are never cached,
  // queued or replayed by the service worker.
  if (url.pathname.startsWith('/api/v1/billing')) {
    if (request.method !== 'GET') {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate' && url.pathname.startsWith('/billing/')) {
    event.respondWith(
      fetch(request).catch(async () => (await caches.open(CACHE)).match('/billing/'))
    );
    return;
  }

  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.startsWith('/billing/') || url.pathname.startsWith('/src/billing/') || url.pathname === '/styles/billing.css' || url.pathname === '/styles/tokens.css' || url.pathname === '/styles/reset.css') {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      }))
    );
  }
});
