import 'server-only';
import { logEvent } from '@/lib/events';
import { explain } from '@/lib/handlers/explainer';
import { createDiagram } from '@/lib/diagrams/generate';
import type { Diagram, ExplainMode, Explainer } from '@/lib/handlers/schemas';
import { HttpError } from '@/lib/http';
import { adjustItemTopics, getPromptContext, WEIGHT } from '@/lib/profile';
import { adminClient } from '@/lib/supabase/server';
import type { ItemRow } from '@/lib/supabase/database.types';
import { getItem, saveOutput } from './service';

/** Explain simpler / Go deeper: regenerates the explainer and replaces it. */
export async function reExplain(userId: string, itemId: string, mode: ExplainMode): Promise<Explainer> {
  const item = await getItem(userId, itemId);
  if (!item.raw_text) throw new HttpError(409, "This one hasn't been read yet.");
  if (item.kind === 'recipe') throw new HttpError(400, 'Recipes have no explainer.');
  const explainer = await explain(item.raw_text, await getPromptContext(userId), mode);
  await saveOutput(userId, itemId, 'explainer', explainer);
  return explainer;
}

/** The Diagram button. 422 if no valid diagram came out after the retry. */
export async function makeDiagram(userId: string, itemId: string): Promise<{ content: Diagram; fileUrl: string }> {
  const item = await getItem(userId, itemId);
  if (!item.raw_text) throw new HttpError(409, "This one hasn't been read yet.");
  if (item.kind === 'recipe') throw new HttpError(400, 'Recipes have no diagram.');
  const result = await createDiagram(userId, itemId, item.raw_text, await getPromptContext(userId));
  if (!result) throw new HttpError(422, "Couldn't draw a clear diagram for this one.");
  return result;
}

export type SimilarItem = Pick<ItemRow, 'id' | 'title' | 'kind' | 'url'> & { similarity: number };

/**
 * Other saves closest to this one, using the item's own chunk embeddings as
 * the query (no AI call). Best chunk score per item, top `limit` items.
 */
export async function similarItems(userId: string, itemId: string, limit = 5): Promise<SimilarItem[]> {
  const db = adminClient();
  const { data: own, error } = await db
    .from('chunks')
    .select('embedding')
    .eq('item_id', itemId)
    .eq('user_id', userId)
    .order('created_at')
    .limit(3);
  if (error) throw error;
  if (!own?.length) return [];

  const best = new Map<string, number>();
  for (const { embedding } of own) {
    const { data: matches, error: matchError } = await db.rpc('match_chunks', {
      p_user_id: userId,
      p_embedding: embedding,
      p_match_count: 20,
      p_exclude_item: itemId,
    });
    if (matchError) throw matchError;
    for (const m of matches ?? []) best.set(m.item_id, Math.max(best.get(m.item_id) ?? 0, m.similarity));
  }

  const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (!ranked.length) return [];
  const { data: items, error: itemsError } = await db
    .from('items')
    .select('id, title, kind, url')
    .eq('user_id', userId)
    .in('id', ranked.map(([id]) => id));
  if (itemsError) throw itemsError;
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  return ranked.flatMap(([id, similarity]) => {
    const item = byId.get(id);
    return item ? [{ ...item, similarity }] : [];
  });
}

/** Latest 👍/👎 for an item: 1, -1, or 0 for none. */
export async function getThumbs(userId: string, itemId: string): Promise<number> {
  const { data, error } = await adminClient()
    .from('events')
    .select('value')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .eq('type', 'thumbs')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.value ?? 0);
}

/**
 * Sets 👍 (1), 👎 (-1) or clears (0). Topic weights move by the difference
 * from the previous vote, so flipping or re-tapping never double-counts.
 */
export async function setThumbs(userId: string, itemId: string, value: -1 | 0 | 1): Promise<void> {
  const previous = await getThumbs(userId, itemId);
  if (previous === value) return;
  const weightOf = (v: number) => (v > 0 ? WEIGHT.thumbsUp : v < 0 ? WEIGHT.thumbsDown : 0);
  await adjustItemTopics(userId, itemId, weightOf(value) - weightOf(previous));
  await logEvent(userId, 'thumbs', { itemId, value });
}
