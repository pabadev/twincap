'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      // Development: purge any service worker / cache left over from a
      // previous session. Serving stale JS chunks against fresh SSR HTML
      // produces phantom hydration mismatches.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed silently
    });
  }, []);

  return null;
}
