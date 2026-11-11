import 'server-only';
import { HttpError } from '@/lib/http';
import type { NudgeAction } from '@/lib/supabase/database.types';
import { adminClient } from '@/lib/supabase/server';

/**
 * The item's 'ready' nudge row, created on first call. Reused on a job retry
 * so a re-run notify step doesn't log a second push.
 */
export async function readyNudgeId(userId: string, itemId: string): Promise<string> {
  const db = adminClient();
  const { data: existing, error } = await db
    .from('nudges')
    .select('id')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .eq('kind', 'ready')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;
  const { data, error: insertError } = await db
    .from('nudges')
    .insert({ user_id: userId, item_id: itemId, kind: 'ready' })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return data.id;
}

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Records the first tap on a notification (later taps of the same one are ignored). */
export async function markTapped(userId: string, nudgeId: string, action: NudgeAction): Promise<void> {
  if (!isUuid(nudgeId)) throw new HttpError(404, 'Notification not found.');
  const { error } = await adminClient()
    .from('nudges')
    .update({ tapped_at: new Date().toISOString(), action })
    .eq('id', nudgeId)
    .eq('user_id', userId)
    .is('tapped_at', null);
  if (error) throw error;
}
