// ─── CACHE VERSION ──────────────────────────────────────────────────────────
// This token is replaced at deploy time by netlify.toml:
//   sed -i "s/__BUILD_ID__/$(date +%s)/" sw.js
// Result: steady-cache-1748000000  (a new name every deploy = old cache purged)
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

// CDN deps: cache on first use (network-first so they stay fresh)
const CDN_ORIGINS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com',
  'https://esm.sh',
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())  // don't wait for old tabs to close
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('steady-cache-') && k !== CACHE_NAME)
            .map((k) => { console.log('[SW] Purging old cache:', k); return caches.delete(k); })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // SPA navigation → always serve shell
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((c) => c || fetch(request))
    );
    return;
  }

  const isCoreAsset = CORE_ASSETS.some((a) => url.pathname === a || url.pathname === a + '/');
  const isCDN       = CDN_ORIGINS.some((o) => request.url.startsWith(o));

  if (isCoreAsset) {
    // Cache-first + background revalidate
    event.respondWith(
      caches.match(request).then((cached) => {
        const net = fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          return res;
        });
        return cached || net;
      })
    );
  } else if (isCDN) {
    // Network-first for CDN (stay fresh, fall back offline)
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request))
    );
  } else {
    event.respondWith(
      caches.match(request).then((c) => c || fetch(request).catch(() => null))
    );
  }
});

// ─── MESSAGES ───────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
