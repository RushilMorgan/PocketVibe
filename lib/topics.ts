import 'server-only';
import { embed } from '@/lib/ai/gemini';
import { HttpError } from '@/lib/http';
import { adminClient } from '@/lib/supabase/server';

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
  const [embedding] = await embed([name], 'SEMANTIC_SIMILARITY');
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
