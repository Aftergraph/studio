const CACHE = 'aftergraph-billing-shell-v4';
const OFFLINE_URL = '/billing/offline.html';
const SHELL = [
  '/billing/',
  '/billing/offline.html',
  '/billing/manifest.webmanifest',
  '/billing/icons/icon-192.svg',
  '/billing/icons/icon-512.svg',
  '/styles/tokens.css',
  '/styles/reset.css',
  '/styles/billing.css',
  '/styles/billing/a11y.css',
  '/styles/billing/approval.css',
  '/styles/billing/base.css',
  '/styles/billing/buttons.css',
  '/styles/billing/command-palette.css',
  '/styles/billing/dashboard.css',
  '/styles/billing/forms.css',
  '/styles/billing/header.css',
  '/styles/billing/list.css',
  '/styles/billing/modal.css',
  '/styles/billing/print.css',
  '/styles/billing/responsive.css',
  '/styles/billing/search.css',
  '/styles/billing/skeleton.css',
  '/styles/billing/states.css',
  '/styles/billing/summary.css',
  '/styles/billing/table.css',
  '/styles/billing/tabs.css',
  '/styles/billing/theme.css',
  '/styles/billing/toast.css',
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
    // API GET: network-first with cache fallback for offline reads
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Navigation: network-first with offline fallback
  if (request.mode === 'navigate' && url.pathname.startsWith('/billing/')) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(request)) || (await cache.match(OFFLINE_URL));
      })
    );
    return;
  }

  // Non-GET: pass through
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets: cache-first
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
