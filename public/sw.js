/* HeyToolie service worker: push notifications, a cache for static assets,
 * and offline lessons (/play pages + lesson JSON, network-first). Plain JS
 * served as-is from /sw.js (no build step). Bump VERSION to evict old caches.
 * Other navigations and API calls always go to the network, and the /share
 * POST from the share sheet is never intercepted. */

const VERSION = 'v3';
const STATIC_CACHE = `static-${VERSION}`;
/** Lesson pages + their JSON, so a lesson opened once can be played offline. */
const LESSON_CACHE = `lessons-${VERSION}`;
const KEEP = [STATIC_CACHE, LESSON_CACHE];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** Network first; on failure (offline) serve the last good copy. */
async function networkFirst(request) {
  const cache = await caches.open(LESSON_CACHE);
  try {
    const res = await fetch(request);
    // Not a redirect: a signed-out visit lands on /login and must not be cached as the lesson.
    if (res.ok && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

const LESSON_PAGE = /^\/play\/[0-9a-f-]{36}$/i;
const LESSON_JSON = /^\/api\/lessons\/[0-9a-f-]{36}$/i;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (LESSON_PAGE.test(url.pathname) || LESSON_JSON.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Hashed build assets never change, so cache-first is safe.
  if (!url.pathname.startsWith('/_next/static/')) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    })(),
  );
});

// Payload: { title, body, url } from lib/notify.ts.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'HeyToolie', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'HeyToolie', {
      body: data.body || '',
      // icon: the full-colour app logo shown in the notification.
      // badge: Android draws this from its alpha channel only (status bar and
      // header), so it must be a white silhouette — a colour image becomes a blob.
      icon: new URL('/icon-192.png', self.location.origin).href,
      badge: new URL('/badge-96.png', self.location.origin).href,
      tag: data.url,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        await open.focus();
        return open.navigate(target);
      }
      return self.clients.openWindow(target);
    })(),
  );
});
