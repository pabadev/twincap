const CACHE_NAME = 'twincap-v6';
// Never precache authenticated routes: cache.addAll would persist the
// server-rendered HTML of user-specific pages in Cache Storage, leaking one
// user's data to whoever is served from the offline cache. Only static,
// non-user-specific assets belong here.
// iOS splash screens are intentionally NOT precached: each device only needs
// its own media-query match and they are fetched before the SW can help.
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API and server-action requests
  if (request.url.includes('/api/') || request.headers.get('Next-Action')) {
    return;
  }

  const url = new URL(request.url);

  // For navigation requests (HTML pages): network-first, no cache
  // This prevents stale HTML with broken chunk hashes
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request)),
    );
    return;
  }

  // For static assets under /_next/static/: stale-while-revalidate
  // Production asset URLs are content-hashed, so a cached copy is always
  // the exact bytes for that URL. Do NOT cache non-hashed files (dev
  // chunks change content under stable URLs and would serve stale JS).
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request)
          .then((response) => {
            if (response.ok && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetched;
      }),
    );
    return;
  }

  // For everything else: network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});
