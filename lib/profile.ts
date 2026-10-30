import 'server-only';
import { embed } from '@/lib/ai/gemini';
import { adminClient } from '@/lib/supabase/server';

export type PromptContext = {
  level: string;
  tone: string;
  top_topics: string;
};

/** How much each signal moves a topic's weight (SPEC → Profile). */
export const WEIGHT = { save: 1, thumbsUp: 2, thumbsDown: -2 } as const;

/** A tag joins an existing topic when its embedding is at least this close. */
const SAME_TOPIC = 0.8;

/** The {level}, {tone} and {top_topics} injected into every prompt. */
export async function getPromptContext(userId: string): Promise<PromptContext> {
  const db = adminClient();
  const [{ data: user, error }, { data: topics, error: topicsError }] = await Promise.all([
    db.from('users').select('level, tone').eq('id', userId).single(),
    db.from('topics').select('name').eq('user_id', userId).gt('weight', 0).order('weight', { ascending: false }).limit(5),
  ]);
  if (error) throw error;
  if (topicsError) throw topicsError;
  return {
    level: user.level,
    tone: user.tone,
    top_topics: topics?.length ? topics.map((t) => t.name).join(', ') : 'nothing yet',
  };
}

/**
 * Files a saved item under topics: each tag joins its nearest topic (cosine ≥
 * 0.8) or starts a new one, and each matched topic gets the save weight.
 * No-op if the item is already linked, so job retries don't double-count.
 */
export async function recordItemTopics(userId: string, itemId: string, tags: string[]): Promise<string[]> {
  const db = adminClient();
  const { count, error: linkedError } = await db
    .from('item_topics')
    .select('topic_id', { count: 'exact', head: true })
    .eq('item_id', itemId);
  if (linkedError) throw linkedError;
  if (count) return [];

  const names = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (!names.length) return [];
  const embeddings = await embed(names, 'SEMANTIC_SIMILARITY');

  const topicIds = new Set<string>();
  for (const [i, name] of names.entries()) {
    topicIds.add(await findOrCreateTopic(userId, name, embeddings[i]));
  }

  const ids = [...topicIds];
  const { error } = await db
    .from('item_topics')
    .insert(ids.map((topic_id) => ({ item_id: itemId, topic_id, user_id: userId })));
  if (error) throw error;
  await adjustItemTopics(userId, itemId, WEIGHT.save);
  return ids;
}

/** Applies a weight change to every topic an item is filed under (thumbs, plays). */
export async function adjustItemTopics(userId: string, itemId: string, delta: number): Promise<void> {
  const db = adminClient();
  const { data: links, error } = await db.from('item_topics').select('topic_id').eq('item_id', itemId).eq('user_id', userId);
  if (error) throw error;
  for (const { topic_id } of links ?? []) {
    const { error: rpcError } = await db.rpc('adjust_topic_weight', { p_topic_id: topic_id, p_delta: delta });
    if (rpcError) throw rpcError;
  }
}

async function findOrCreateTopic(userId: string, name: string, embedding: string): Promise<string> {
  const db = adminClient();

  const { data: nearest, error: matchError } = await db.rpc('match_topic', { p_user_id: userId, p_embedding: embedding });
  if (matchError) throw matchError;
  if (nearest?.[0] && nearest[0].similarity >= SAME_TOPIC) return nearest[0].id;

  // Names are stored lowercase, so an exact match finds a same-named topic.
  const byName = () => db.from('topics').select('id').eq('user_id', userId).eq('name', name).maybeSingle();
  const { data: existing, error: findError } = await byName();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: created, error } = await db.from('topics').insert({ user_id: userId, name, embedding }).select('id').single();
  if (!error) return created.id;
  if (error.code !== '23505') throw error;
  // Lost a race with a concurrent job creating the same topic.
  const { data: raced, error: raceError } = await byName();
  if (raceError || !raced) throw raceError ?? error;
  return raced.id;
}
