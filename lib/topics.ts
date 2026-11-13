import 'server-only';
import { z } from 'zod';
import { embed, generateJson } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import { HttpError } from '@/lib/http';
import { adminClient } from '@/lib/supabase/server';
import {
  assignThemes,
  kindMix,
  themesHash,
  TOP_N,
  topicTrend,
  type KindShare,
  type Theme,
  type TopicSave,
  type TopicThemesCache,
  type TopicView,
} from '@/lib/topic-view';

export interface TopicSummary {
  id: string;
  name: string;
  weight: number;
  itemCount: number;
  lastSeenAt: string;
}

/** The interest profile, strongest first. Topics that faded to ≤ 0 are kept but listed last. */
export async function listTopics(userId: string): Promise<TopicSummary[]> {
  const db = adminClient();
  const [{ data: topics, error }, { data: links, error: linksError }] = await Promise.all([
    db.from('topics').select('id, name, weight, last_seen_at').eq('user_id', userId).order('weight', { ascending: false }),
    db.from('item_topics').select('topic_id').eq('user_id', userId),
  ]);
  if (error) throw error;
  if (linksError) throw linksError;

  const counts = new Map<string, number>();
  for (const { topic_id } of links ?? []) counts.set(topic_id, (counts.get(topic_id) ?? 0) + 1);
  return (topics ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    weight: Math.round(t.weight * 10) / 10,
    itemCount: counts.get(t.id) ?? 0,
    lastSeenAt: t.last_seen_at,
  }));
}

/** Renames a topic and re-embeds it so future saves match the new name. */
export async function renameTopic(userId: string, topicId: string, rawName: string): Promise<void> {
  const name = rawName.trim().toLowerCase();
  if (!name) throw new HttpError(400, 'Give the topic a name.');
  const [embedding] = await embed([name], 'SEMANTIC_SIMILARITY', 'topics');
  const { data, error } = await adminClient()
    .from('topics')
    .update({ name, embedding })
    .eq('id', topicId)
    .eq('user_id', userId)
    .select('id');
  if (error?.code === '23505') throw new HttpError(409, 'You already have a topic with that name.');
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, 'Topic not found.');
}

/** Forget a topic: removes it from the profile and untags its items (the items stay). */
export async function forgetTopic(userId: string, topicId: string): Promise<void> {
  const { error } = await adminClient().from('topics').delete().eq('id', topicId).eq('user_id', userId);
  if (error) throw error;
}

// ── Topics page ──────────────────────────────────────────────────────────────

export interface TopicsPage {
  topics: TopicView[];
  /** null when the grouping couldn't be made; the page then shows one cloud. */
  themes: Theme[] | null;
  mix: KindShare[];
}

/**
 * Everything the Topics page shows: each topic with its newest saves and
 * trend, the user's mix of save kinds, and the topics grouped into themes.
 * Themes come from one fast-model call, cached on users.topic_themes until a
 * topic is added, renamed, merged or forgotten.
 */
export async function topicsPage(userId: string, now = new Date()): Promise<TopicsPage> {
  const db = adminClient();
  const [{ data: topics, error }, { data: links, error: linksError }, { data: items, error: itemsError }, { data: user }] =
    await Promise.all([
      db.from('topics').select('id, name, weight, last_seen_at, created_at').eq('user_id', userId).order('weight', { ascending: false }),
      db.from('item_topics').select('topic_id, item_id').eq('user_id', userId),
      db
        .from('items')
        .select('id, title, url, kind, thumbnail_url, created_at')
        .eq('user_id', userId)
        .eq('status', 'done')
        .order('created_at', { ascending: false }),
      db.from('users').select('topic_themes').eq('id', userId).maybeSingle(),
    ]);
  if (error) throw error;
  if (linksError) throw linksError;
  if (itemsError) throw itemsError;

  const itemById = new Map((items ?? []).map((i) => [i.id, i]));
  const savesByTopic = new Map<string, TopicSave[]>();
  for (const l of links ?? []) {
    const item = itemById.get(l.item_id);
    if (!item) continue;
    const list = savesByTopic.get(l.topic_id) ?? [];
    list.push({ id: item.id, title: item.title, url: item.url, kind: item.kind, thumbnail_url: item.thumbnail_url });
    savesByTopic.set(l.topic_id, list);
  }
  // Newest saves first, using the items' own order.
  const order = new Map((items ?? []).map((i, n) => [i.id, n]));
  const views: TopicView[] = (topics ?? []).map((t, n) => {
    const saves = (savesByTopic.get(t.id) ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return {
      id: t.id,
      name: t.name,
      weight: Math.round(t.weight * 10) / 10,
      itemCount: saves.length,
      lastSeenAt: t.last_seen_at,
      createdAt: t.created_at,
      saves: saves.slice(0, 4),
      trend: topicTrend({ createdAt: t.created_at, lastSeenAt: t.last_seen_at }, now),
      top: n < TOP_N && t.weight > 0,
    };
  });

  return {
    topics: views,
    themes: await cachedThemes(userId, views, user?.topic_themes ?? null),
    mix: kindMix((items ?? []).map((i) => i.kind)),
  };
}

const themesSchema = z.object({
  themes: z
    .array(z.object({ name: z.string().min(1).max(40), emoji: z.string().max(8), topics: z.array(z.string()) }))
    .min(1)
    .max(8),
});

/** Themes for the current topic set: from the cache, or one Flash call (best-effort). */
async function cachedThemes(userId: string, topics: TopicView[], cache: TopicThemesCache | null): Promise<Theme[] | null> {
  if (topics.length === 0) return [];
  const hash = themesHash(topics);
  if (cache?.hash === hash) return cache.themes;
  try {
    const list = topics.map((t) => `- ${t.name} (${t.itemCount})`).join('\n');
    const result = await generateJson(themesSchema, [{ text: await prompt('topic-themes', { topics: list }) }], { feature: 'topics' });
    const themes = assignThemes(topics, result.themes);
    await adminClient().from('users').update({ topic_themes: { hash, themes } }).eq('id', userId);
    return themes;
  } catch (err) {
    console.error('topic themes failed', err);
    if (!cache?.themes?.length) return null; // The page shows one cloud instead.
    // Reuse the last grouping; topics added since land in "Everything else".
    const nameById = new Map(topics.map((t) => [t.id, t.name]));
    return assignThemes(
      topics,
      cache.themes.map((t) => ({ ...t, topics: t.topicIds.flatMap((id) => nameById.get(id) ?? []) })),
    );
  }
}

/**
 * Folds one topic into another: its saves are tagged with the other topic,
 * its weight is added on, and it's deleted. The saves themselves don't change.
 */
export async function mergeTopic(userId: string, fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) throw new HttpError(400, 'Pick a different topic to merge into.');
  const db = adminClient();
  const { data: pair, error } = await db.from('topics').select('id, weight, last_seen_at').eq('user_id', userId).in('id', [fromId, intoId]);
  if (error) throw error;
  const from = pair?.find((t) => t.id === fromId);
  const into = pair?.find((t) => t.id === intoId);
  if (!from || !into) throw new HttpError(404, 'Topic not found.');

  const { data: links, error: linksError } = await db.from('item_topics').select('item_id').eq('user_id', userId).eq('topic_id', fromId);
  if (linksError) throw linksError;
  if (links?.length) {
    const { error: upsertError } = await db
      .from('item_topics')
      .upsert(
        links.map((l) => ({ item_id: l.item_id, topic_id: intoId, user_id: userId })),
        { onConflict: 'item_id,topic_id', ignoreDuplicates: true },
      );
    if (upsertError) throw upsertError;
  }
  const { error: updateError } = await db
    .from('topics')
    .update({
      weight: into.weight + Math.max(0, from.weight),
      last_seen_at: from.last_seen_at > into.last_seen_at ? from.last_seen_at : into.last_seen_at,
    })
    .eq('id', intoId)
    .eq('user_id', userId);
  if (updateError) throw updateError;
  await forgetTopic(userId, fromId);
}
