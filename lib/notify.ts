import 'server-only';
import webpush from 'web-push';
import { pushEnv } from '@/lib/env';
import { adminClient } from '@/lib/supabase/server';

export interface PushMessage {
  title: string;
  body: string;
  /** Same-site path the notification opens, e.g. /items/<id>. */
  url: string;
}

/**
 * Sends a web push to every device the user has registered. Endpoints the push
 * service reports as gone (404/410) are removed. Returns how many were sent.
 * A missing VAPID config just skips sending: push is a nicety, not a blocker.
 */
export async function notifyUser(userId: string, message: PushMessage): Promise<number> {
  const vapid = pushEnv();
  if (!vapid) {
    console.warn('notify: VAPID keys not set, skipping push');
    return 0;
  }
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const db = adminClient();
  const { data: devices, error } = await db.from('push_devices').select('endpoint, p256dh, auth').eq('user_id', userId);
  if (error) throw error;

  const payload = JSON.stringify(message);
  let sent = 0;
  await Promise.all(
    (devices ?? []).map(async (d) => {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, {
          TTL: 60 * 60 * 24,
        });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from('push_devices').delete().eq('endpoint', d.endpoint);
        } else {
          console.error('notify: push failed', status, err);
        }
      }
    }),
  );
  return sent;
}
