const CACHE_NAME = 'globalmoney-v2';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
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

  // For static assets (_next/static/, images, etc.): stale-while-revalidate
  // These have content hashes so stale versions are safe
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
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
