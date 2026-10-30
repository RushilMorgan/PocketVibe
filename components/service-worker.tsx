'use client';

import { useEffect } from 'react';

/** Registers /sw.js once per page load (push + static asset cache). */
export function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => console.error('SW registration failed', err));
    }
  }, []);
  return null;
}
