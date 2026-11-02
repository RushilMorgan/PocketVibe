import 'server-only';
import { z } from 'zod';
import { embed, streamText, type ChatTurn } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import { getItem } from '@/lib/items/service';
import { getPromptContext } from '@/lib/profile';
import { adminClient } from '@/lib/supabase/server';

export const chatRequest = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
  /** Set to chat about one item; omit to ask the whole library. */
  itemId: z.uuid().optional(),
});

export type ChatRequest = z.infer<typeof chatRequest>;

/** A cited source, numbered as the model sees it ([1] = sources[0]). */
export interface ChatSource {
  n: number;
  itemId: string;
  title: string;
}

/** Library answers draw on the closest chunks across all saves (SPEC: top 8). */
const LIBRARY_CHUNKS = 8;
/**
 * …but no more than this many from one save, picked from a wider candidate
 * pool. Otherwise one long article fills every slot and a two-part question
 * ("RAG, and pancakes?") never sees the short recipe.
 */
const PER_ITEM = 3;
const CANDIDATES = 24;

/**
 * The clauses of a compound question ("How does RAG work, and what do I need
 * for pancakes?") as separate search queries — one blended embedding favours
 * whichever half dominates. [] for a simple question. Pure.
 */
export function splitQuestion(question: string): string[] {
  const parts = question
    .split(/\?|;|\.\s|,?\s+(?:and|also|plus)\s+(?=(?:what|how|why|when|where|which|who|is|are|do|does|can|should|tell|explain)\b)/i)
    .map((p) => p.trim().replace(/^(and|also|plus)\s+/i, ''))
    .filter((p) => p.split(/\s+/).length >= 3);
  return parts.length > 1 ? parts.slice(0, 3) : [];
}

/** Round-robin merge of ranked lists, dropping repeats (same chunk id). Pure. */
export function interleave<T extends { id: string }>(lists: T[][]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (let rank = 0; rank < Math.max(0, ...lists.map((l) => l.length)); rank++) {
    for (const list of lists) {
      const chunk = list[rank];
      if (chunk && !seen.has(chunk.id)) {
        seen.add(chunk.id);
        out.push(chunk);
      }
    }
  }
  return out;
}

/** Best-first chunks, keeping at most `perItem` per item, up to `limit`. Pure. */
export function diversify<T extends { item_id: string }>(ranked: T[], limit: number, perItem: number): T[] {
  const taken = new Map<string, number>();
  const out: T[] = [];
  for (const chunk of ranked) {
    const n = taken.get(chunk.item_id) ?? 0;
    if (n >= perItem) continue;
    taken.set(chunk.item_id, n + 1);
    out.push(chunk);
    if (out.length === limit) break;
  }
  return out;
}
/** Item chat reads the item's own text directly, capped to keep calls cheap. */
const ITEM_CONTEXT_CHARS = 30_000;
const HISTORY_TURNS = 8;

/** Retrieves context, then streams a cited answer. Sources are known up front. */
export async function answer(userId: string, req: ChatRequest): Promise<{ sources: ChatSource[]; stream: AsyncGenerator<string> }> {
  const question = req.messages.at(-1)!.content;
  const { sources, context } = req.itemId ? await itemContext(userId, req.itemId) : await libraryContext(userId, question);

  const system = await prompt('chat', { ...(await getPromptContext(userId)), sources: context || '(none found)' });
  const turns: ChatTurn[] = req.messages
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.content }));
  return { sources, stream: streamText(system, turns) };
}

async function itemContext(userId: string, itemId: string) {
  const item = await getItem(userId, itemId);
  const title = item.title ?? item.url;
  return {
    sources: [{ n: 1, itemId: item.id, title }],
    context: `[1] ${title}\n${(item.raw_text ?? item.summary ?? '').slice(0, ITEM_CONTEXT_CHARS)}`,
  };
}

async function libraryContext(userId: string, question: string) {
  const db = adminClient();
  // The whole question plus each clause of a compound one, in one embed call.
  const queries = [question, ...splitQuestion(question)];
  const embeddings = await embed(queries, 'RETRIEVAL_QUERY');
  const perQuery = await Promise.all(
    embeddings.map(async (p_embedding) => {
      const { data, error } = await db.rpc('match_chunks', { p_user_id: userId, p_embedding, p_match_count: CANDIDATES });
      if (error) throw error;
      return data ?? [];
    }),
  );
  const chunks = diversify(interleave(perQuery), LIBRARY_CHUNKS, PER_ITEM);
  if (!chunks.length) return { sources: [], context: '' };

  const itemIds = [...new Set(chunks.map((c) => c.item_id))];
  const { data: items, error: itemsError } = await db.from('items').select('id, title, url').eq('user_id', userId).in('id', itemIds);
  if (itemsError) throw itemsError;
  const titles = new Map((items ?? []).map((i) => [i.id, i.title ?? i.url]));

  // One number per item, in order of first (best) appearance.
  const sources: ChatSource[] = itemIds.map((itemId, i) => ({ n: i + 1, itemId, title: titles.get(itemId) ?? 'Untitled' }));
  const number = new Map(sources.map((s) => [s.itemId, s.n]));
  const context = chunks.map((c) => `[${number.get(c.item_id)}] ${c.text}`).join('\n\n');
  return { sources, context };
}
