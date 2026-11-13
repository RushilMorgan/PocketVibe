import 'server-only';
import { getPromptContext } from '@/lib/profile';
import { adminClient } from '@/lib/supabase/server';
import { findsFor } from './finds';
import { groupByTopic, weekStart, type DigestContent, type Find } from './schema';

const DAY = 86_400_000;
const LINE_CHARS = 140;
const TOP_TOPICS = 3;

const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });

/** "Your week": the last 7 days of saves, grouped by their strongest topic. */
export async function yourWeek(userId: string, now: Date): Promise<Pick<DigestContent, 'from' | 'to' | 'groups' | 'stats'>> {
  const db = adminClient();
  const since = new Date(now.getTime() - 7 * DAY);
  const [{ data: items, error }, { count: played, error: playedError }] = await Promise.all([
    db
      .from('items')
      .select('id, title, url, summary')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false }),
    db.from('events').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'played').gte('created_at', since.toISOString()),
  ]);
  if (error) throw error;
  if (playedError) throw playedError;

  const ids = (items ?? []).map((i) => i.id);
  const { data: links, error: linksError } = ids.length
    ? await db.from('item_topics').select('item_id, topics(name, weight)').in('item_id', ids)
    : { data: [], error: null };
  if (linksError) throw linksError;

  const topicsByItem = new Map<string, { name: string; weight: number }[]>();
  for (const link of (links ?? []) as unknown as { item_id: string; topics: { name: string; weight: number } | null }[]) {
    if (link.topics) topicsByItem.set(link.item_id, [...(topicsByItem.get(link.item_id) ?? []), link.topics]);
  }

  const rows = (items ?? []).map((i) => ({
    id: i.id,
    title: i.title ?? i.url,
    line: (i.summary?.split('\n')[0] ?? '').slice(0, LINE_CHARS),
  }));
  return {
    from: fmt(since),
    to: fmt(now),
    groups: groupByTopic(rows, (id) => topicsByItem.get(id) ?? []),
    stats: { saved: rows.length, played: played ?? 0 },
  };
}

/** "New for you" setup: the top 3 topics, and every URL already saved (never suggested). */
export async function findsPlan(userId: string): Promise<{ topics: string[]; saved: string[] }> {
  const db = adminClient();
  const [{ data: topics, error }, { data: saved, error: savedError }] = await Promise.all([
    db.from('topics').select('name').eq('user_id', userId).gt('weight', 0).order('weight', { ascending: false }).limit(TOP_TOPICS),
    db.from('items').select('url').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
  ]);
  if (error) throw error;
  if (savedError) throw savedError;
  return { topics: (topics ?? []).map((t) => t.name), saved: (saved ?? []).map((s) => s.url) };
}

/**
 * Up to 3 finds for one topic, skipping saved URLs and anything picked for an
 * earlier topic. Runs as its own job step (each takes 30–70 s). Never throws:
 * a topic with no good finds is just left out of the digest.
 */
export async function findsForTopic(
  userId: string,
  topic: string,
  saved: string[],
  earlier: DigestContent['finds'],
): Promise<Find[]> {
  const picked = earlier.flatMap((f) => f.items);
  const seen = new Set([...saved, ...picked.map((f) => f.url)]);
  try {
    return await findsFor(topic, await getPromptContext(userId), seen, picked.map((f) => f.title));
  } catch (err) {
    console.error('digest: finds failed for', topic, err);
    return [];
  }
}

/** The newest what-if that's written but never opened (lib/whatif), or null. No AI call: it's already written. */
export async function suggestedWhatIf(userId: string): Promise<NonNullable<DigestContent['whatif']> | null> {
  const db = adminClient();
  const { data: whatif, error } = await db
    .from('whatifs')
    .select('item_id, scenario')
    .eq('user_id', userId)
    .eq('kind', 'main')
    .eq('status', 'done')
    .is('opened_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!whatif) return null;
  const { data: item, error: itemError } = await db
    .from('items')
    .select('title, url')
    .eq('id', whatif.item_id)
    .eq('user_id', userId)
    .single();
  if (itemError) throw itemError;
  return { itemId: whatif.item_id, itemTitle: item.title ?? item.url, scenario: whatif.scenario };
}

/** Saves this week's digest (replacing a re-run of the same week) and returns its id. */
export async function saveDigest(userId: string, now: Date, content: DigestContent): Promise<string> {
  const { data, error } = await adminClient()
    .from('digests')
    .upsert({ user_id: userId, week_start: weekStart(now), content }, { onConflict: 'user_id,week_start' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
