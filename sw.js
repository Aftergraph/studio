const CACHE = 'aftergraph-workspace-v5-agentic-1';
const SHELL = [
  '/', '/index.html', '/styles/tokens.css', '/styles/reset.css', '/styles/shell.css', '/styles/components.css', '/styles/views.css', '/styles/motion.css', '/styles/responsive.css', '/manifest.webmanifest',
  '/src/main.mjs', '/src/domain.mjs', '/src/router.mjs', '/src/state.mjs',
  '/src/search.mjs', '/src/ui-helpers.mjs', '/src/workspace-shell.mjs',
  '/src/icons.mjs', '/src/live-runtime.mjs', '/src/api-client.mjs', '/src/surface-lifecycle.mjs', '/src/replay.mjs',
  '/packages/brand/index.mjs', '/packages/brand/tokens.css',
  '/packages/tokens/index.mjs', '/packages/icons/index.mjs',
  '/packages/motion/index.mjs', '/packages/runtime-ui/index.mjs',
  '/packages/ui/index.mjs', '/packages/spatial/index.mjs', '/packages/presence/index.mjs',
  '/packages/interaction/index.mjs', '/packages/visualization/index.mjs', '/packages/composer/index.mjs'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return caches.match('/index.html');
    throw new Error('offline cache miss');
  }));
});
