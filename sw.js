// ─── CACHE VERSION ──────────────────────────────────────────────────────────
// This token is replaced at deploy time by netlify.toml:
//   sed -i "s/__BUILD_ID__/$(date +%s)/" sw.js
// Result: steady-cache-1748000000 (new cache every deploy)
const CACHE_VERSION = '__BUILD_ID__';
const CACHE_NAME = `steady-cache-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.webmanifest',
  '/icons/steady-192.png',
  '/icons/steady-512.png',
  '/icons/steady-maskable-512.png',
];

const BOOT_ASSETS = new Set(['/', '/index.html', '/script.js']);

// CDN deps: network-first so they stay fresh, with offline fallback
const CDN_ORIGINS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com',
  'https://esm.sh',
];

const putInCache = async (request, response) => {
  if (!response || !response.ok) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('steady-cache-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  const isCDN = CDN_ORIGINS.some((o) => request.url.startsWith(o));
  const isCoreAsset = CORE_ASSETS.some((a) => url.pathname === a || url.pathname === `${a}/`);
  const isBootAsset = BOOT_ASSETS.has(url.pathname);

  if (request.mode === 'navigate' || isBootAsset) {
    event.respondWith(
      fetch(request)
        .then((res) => putInCache(request, res))
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  if (isCoreAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => putInCache(request, res))
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  if (isCDN) {
    event.respondWith(
      fetch(request)
        .then((res) => putInCache(request, res))
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => null))
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
