/// <reference lib="webworker" />
/**
 * PocketVibe service worker (injectManifest mode — see vite.config.ts).
 *
 * We own this file fully; vite-plugin-pwa only injects the precache manifest at
 * the `self.__WB_MANIFEST` placeholder and wires registration/update handling.
 *
 * Deliberately minimal. Three jobs:
 *   1. Precache hashed build assets so repeat loads are instant. We exclude HTML
 *      (globPatterns in the config) so navigations always hit the network and
 *      respect the `must-revalidate` headers in vercel.json — no stale-shell bug.
 *   2. Receive Web Push messages and surface them as notifications (Phase 3).
 *   3. Focus/open the right creation when a notification is tapped.
 *
 * The Web Share Target (manifest `share_target`) is a normal navigation to
 * `/share` — it needs no service-worker code; main.tsx routes it.
 */
import { precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';

// sw.ts is a module (it imports), so this declaration shadows the ambient
// `self` rather than redeclaring it — no conflict under the WebWorker lib.
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

// Injected at build time — hashed JS/CSS only (see injectManifest.globPatterns).
precacheAndRoute(self.__WB_MANIFEST);

// Take control as soon as an updated worker activates so push/notification
// handlers are never served by a stale worker after a deploy.
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Push ──────────────────────────────────────────────────────────────────────
// Payload shape (set by the pocketvibe-push edge function):
//   { title: string; body: string; url?: string; tag?: string }
interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = { title: 'Hey Toolie', body: 'Something is ready for you.' };
  try {
    if (event.data) payload = { ...payload, ...(event.data.json() as Partial<PushPayload>) };
  } catch {
    // Non-JSON payload — fall back to the plain text body if present.
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: payload.tag,
      data: { url: payload.url ?? '/' },
    }),
  );
});

// ── Notification click ──────────────────────────────────────────────────────────
// Focus an existing tab if one is open, otherwise open the target URL.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string | undefined) ?? '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        // Reuse any already-open PocketVibe tab.
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && targetUrl !== '/') {
            try {
              await (client as WindowClient).navigate(targetUrl);
            } catch {
              /* navigate can reject cross-origin; ignore */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
