import 'server-only';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/server';

/** The browser's PushSubscription.toJSON() shape. */
export const pushSubscription = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export type PushSubscriptionJson = z.infer<typeof pushSubscription>;

/** Saves (or moves to this user) one device's push endpoint. */
export async function registerDevice(userId: string, sub: PushSubscriptionJson, userAgent: string | null): Promise<void> {
  const { error } = await adminClient().from('push_devices').upsert({
    endpoint: sub.endpoint,
    user_id: userId,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: userAgent?.slice(0, 300) ?? null,
  });
  if (error) throw error;
}

export async function removeDevice(userId: string, endpoint: string): Promise<void> {
  const { error } = await adminClient().from('push_devices').delete().eq('endpoint', endpoint).eq('user_id', userId);
  if (error) throw error;
}
