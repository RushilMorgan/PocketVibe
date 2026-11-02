import 'server-only';
import { createLesson, unplayedLesson } from '@/lib/lessons/service';
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

/**
 * One lesson from something saved but never opened: the newest such item
 * (not a recipe). Reuses its pre-written lesson or writes one.
 */
export async function suggestedLesson(userId: string): Promise<DigestContent['lesson']> {
  const db = adminClient();
  const [{ data: items, error }, { data: opened, error: openedError }] = await Promise.all([
    db
      .from('items')
      .select('id, title, url')
      .eq('user_id', userId)
      .eq('status', 'done')
      .neq('kind', 'recipe')
      .order('created_at', { ascending: false })
      .limit(50),
    db.from('events').select('item_id').eq('user_id', userId).eq('type', 'opened').not('item_id', 'is', null),
  ]);
  if (error) throw error;
  if (openedError) throw openedError;

  const openedIds = new Set((opened ?? []).map((o) => o.item_id));
  for (const item of (items ?? []).filter((i) => !openedIds.has(i.id)).slice(0, 3)) {
    try {
      const lessonId = (await unplayedLesson(userId, item.id)) ?? (await createLesson(userId, item.id));
      return { itemId: item.id, itemTitle: item.title ?? item.url, lessonId };
    } catch (err) {
      console.warn('digest: no lesson for', item.id, err);
    }
  }
  return null;
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
