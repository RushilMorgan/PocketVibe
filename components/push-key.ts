/** VAPID public key (URL-safe base64) → the bytes PushManager.subscribe wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Whether an existing browser subscription was made with this VAPID key. A
 * subscription from an older key (e.g. the previous site) can't receive our
 * pushes — the push service rejects them with 403.
 */
export function subscribedWithKey(applicationServerKey: ArrayBuffer | null | undefined, vapidPublicKey: string): boolean {
  if (!applicationServerKey) return false;
  const have = new Uint8Array(applicationServerKey);
  const want = urlBase64ToUint8Array(vapidPublicKey);
  return have.length === want.length && have.every((b, i) => b === want[i]);
}
