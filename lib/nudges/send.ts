import 'server-only';
import { getFeed } from '@/lib/items/feed-service';
import { notifyUser } from '@/lib/notify';
import { adminClient } from '@/lib/supabase/server';
import { pickReminder, reminderMessage, slotAt, type ReminderChoice } from './reminders';

/** How far back reminder history matters (back-off, never-twice). */
const HISTORY_DAYS = 30;

/** Users with a reminder slot at `now` and at least one device to send to. */
export async function usersDueAt(now: Date): Promise<string[]> {
  const db = adminClient();
  const { minutes } = slotAt(now);
  const { data: users, error } = await db.from('users').select('id').contains('reminder_times', [minutes]);
  if (error) throw error;
  if (!users?.length) return [];
  const { data: devices, error: devError } = await db
    .from('push_devices')
    .select('user_id')
    .in('user_id', users.map((u) => u.id));
  if (devError) throw devError;
  return [...new Set((devices ?? []).map((d) => d.user_id))];
}

/**
 * Picks and sends this slot's reminder for one user, if any. The nudges row
 * is inserted first with the slot as a unique key, so a re-run step (Inngest
 * retry) can never send the same slot twice — at worst one is lost.
 */
export async function sendReminder(userId: string, now: Date): Promise<{ sent: boolean; kind?: ReminderChoice['kind'] }> {
  const db = adminClient();
  const since = new Date(now.getTime() - HISTORY_DAYS * 24 * 3600_000).toISOString();
  const [{ data: user, error }, { data: history, error: historyError }, feed] = await Promise.all([
    db.from('users').select('reminder_times').eq('id', userId).single(),
    db.from('nudges').select('kind, item_id, sent_at, tapped_at').eq('user_id', userId).gte('sent_at', since),
    getFeed(userId, { limit: 100 }, now),
  ]);
  if (error) throw error;
  if (historyError) throw historyError;

  const choice = pickReminder({ feed, history: history ?? [], times: user.reminder_times, now });
  if (!choice) return { sent: false };

  const { data: row, error: insertError } = await db
    .from('nudges')
    .insert({
      user_id: userId,
      item_id: choice.kind === 'lesson' ? choice.itemId : null,
      kind: choice.kind,
      slot: slotAt(now).key,
      sent_at: now.toISOString(),
    })
    .select('id')
    .single();
  if (insertError) {
    if (insertError.code === '23505') return { sent: false }; // This slot already went out.
    throw insertError;
  }

  let template: string | null = null;
  if (choice.kind === 'lesson') {
    const { data: lesson } = await db
      .from('item_outputs')
      .select('template:content->>template')
      .eq('id', choice.lessonId)
      .eq('user_id', userId)
      .maybeSingle();
    template = (lesson as { template?: string } | null)?.template ?? null;
  }

  await notifyUser(userId, reminderMessage(choice, row.id, template));
  return { sent: true, kind: choice.kind };
}
