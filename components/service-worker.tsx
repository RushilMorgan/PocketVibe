'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js (push, static cache, offline lessons) in production only.
 * Dev chunk URLs aren't content-hashed, so the worker's cache-first static
 * cache would pin stale JS/CSS; in dev we unregister any leftover worker.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => console.error('SW registration failed', err));
      return;
    }
    navigator.serviceWorker.getRegistrations().then(async (regs) => {
      if (!regs.length) return;
      await Promise.all(regs.map((r) => r.unregister()));
      for (const key of await caches.keys()) await caches.delete(key);
    });
  }, []);
  return null;
}
