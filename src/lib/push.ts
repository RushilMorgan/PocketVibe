/**
 * Web Push — client helpers.
 *
 * Subscribes the browser to push via the service worker and stores the
 * subscription in Supabase so the pocketvibe-push edge function can send to it.
 * Android (and installed iOS 16.4+ PWAs) support this; everything degrades to a
 * no-op where the APIs or VAPID key are absent.
 */
import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** True when this browser can do Web Push at all. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Current permission, or 'unsupported'. */
export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/** VAPID public key (base64url) → Uint8Array, as the PushManager requires. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  // Back the view with a concrete ArrayBuffer so it satisfies BufferSource
  // (TS 6.0 distinguishes ArrayBuffer from the SharedArrayBuffer-inclusive default).
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Request permission (if needed), subscribe via the SW, and persist the
 * subscription. Returns true on success. Safe to call when unsupported — it
 * just returns false. Pass the signed-in user id to attach the subscription.
 */
export async function enablePush(userId?: string | null): Promise<boolean> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY || !supabase) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;

  // Reuse an existing subscription, else create one.
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: json.endpoint,
        user_id: userId ?? null,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 255),
      },
      { onConflict: 'endpoint' },
    );

  return !error;
}
