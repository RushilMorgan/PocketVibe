import 'server-only';
import { adminClient } from '@/lib/supabase/server';
import type { EventType } from '@/lib/supabase/database.types';

/** Appends to the behaviour log that powers the day-30 success test. */
export async function logEvent(
  userId: string,
  type: EventType,
  opts: { itemId?: string; value?: number } = {},
): Promise<void> {
  const { error } = await adminClient()
    .from('events')
    .insert({ user_id: userId, type, item_id: opts.itemId ?? null, value: opts.value ?? null });
  // Analytics must never break the user's action.
  if (error) console.error('logEvent failed', type, error);
}
