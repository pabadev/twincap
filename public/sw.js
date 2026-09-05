const CACHE_NAME = 'twincap-v7';
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

// Public, non-authenticated routes eligible for offline shell caching.
// Everything under "(main)" (dashboard, accounts, ...) and "(auth)"
// (login, register, ...) is intentionally excluded: auth pages may embed
// token/email query params (e.g. /verify-email?token=...) and must never
// be persisted. "/" redirects logged-in users to /dashboard server-side,
// so it can only ever cache the anonymous landing.
const PUBLIC_SHELL_PATHS = [
  '/',
  '/help',
  '/privacy',
  '/terms',
  '/cookies',
  '/data-policy',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        // Tolerant per-asset caching: a single 404 (e.g. a removed asset
        // still listed here) must not fail the whole install and strand the
        // new worker in "installing" forever (the "reinstall fixed it"
        // symptom). Failed assets are simply skipped.
        STATIC_ASSETS.map((asset) => cache.add(asset).catch(() => {})),
      ),
    ),
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

  // For navigation requests (HTML pages): network-first, with a runtime
  // cached copy of the public shell as offline fallback.
  // Network-first prevents stale HTML with broken chunk hashes while
  // online; the shell fallback keeps navigation usable offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Runtime-cache only public, non-authenticated shell pages after
          // they were served successfully. Authenticated routes never match
          // PUBLIC_SHELL_PATHS, and server-side redirects (e.g. "/" for a
          // logged-in user) resolve to URLs outside the list, so no
          // user-specific HTML is ever persisted.
          if (
            response.ok &&
            response.type === 'basic' &&
            PUBLIC_SHELL_PATHS.includes(url.pathname)
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/')),
        ),
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
