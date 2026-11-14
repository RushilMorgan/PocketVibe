import 'server-only';
import { adminClient } from '@/lib/supabase/server';
import { DEFAULT_TZ } from '@/lib/time';
import { buildStats, type Stats, type StatsInput } from './stats';

/** PostgREST returns at most this many rows per request. */
const PAGE = 1000;

/** The Stats page for one user: rows from five tables, shaped by lib/stats.ts. */
export async function getStats(userId: string, now = new Date()): Promise<Stats> {
  const db = adminClient();
  const [items, events, whatIfs, reviews, cooks, user] = await Promise.all([
    db.from('items').select('id, kind, status, created_at, cook_list_at').eq('user_id', userId),
    allEvents(userId),
    db.from('item_outputs').select('item_id').eq('user_id', userId).eq('type', 'whatif'),
    db.from('reviews').select('item_id, created_at').eq('user_id', userId),
    db.from('cooks').select('item_id, created_at').eq('user_id', userId),
    db.from('users').select('timezone').eq('id', userId).maybeSingle(),
  ]);
  for (const r of [items, whatIfs, reviews, cooks, user]) if (r.error) throw r.error;
  return buildStats(
    { items: items.data ?? [], events, whatIfs: whatIfs.data ?? [], reviews: reviews.data ?? [], cooks: cooks.data ?? [] },
    now,
    user.data?.timezone ?? DEFAULT_TZ,
  );
}

async function allEvents(userId: string): Promise<StatsInput['events']> {
  const db = adminClient();
  const out: StatsInput['events'] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('events')
      .select('item_id, type, created_at')
      .eq('user_id', userId)
      .in('type', ['opened', 'played', 'whatif_open', 'digest_open'])
      .order('created_at')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}
