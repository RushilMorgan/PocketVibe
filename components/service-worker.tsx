'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js (push, static cache, offline lessons) in production only,
 * and checks for a newer worker whenever the app comes back to the
 * foreground — an installed app resumed from recents never reloads, so it
 * would otherwise keep an old worker (and its push handling) for days.
 * Dev chunk URLs aren't content-hashed, so the worker's cache-first static
 * cache would pin stale JS/CSS; in dev we unregister any leftover worker.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV === 'production') {
      let reg: ServiceWorkerRegistration | undefined;
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((r) => (reg = r))
        .catch((err) => console.error('SW registration failed', err));
      const onVisible = () => {
        if (document.visibilityState === 'visible') reg?.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }
    navigator.serviceWorker.getRegistrations().then(async (regs) => {
      if (!regs.length) return;
      await Promise.all(regs.map((r) => r.unregister()));
      for (const key of await caches.keys()) await caches.delete(key);
    });
  }, []);
  return null;
}
