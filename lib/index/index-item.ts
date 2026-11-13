import 'server-only';
import { embed } from '@/lib/ai/gemini';
import { adminClient } from '@/lib/supabase/server';
import { chunkText } from './chunk';

/**
 * Chunks and embeds an item's text for "ask my library" and "similar".
 * Each chunk is prefixed with the title so retrieved snippets keep context.
 * Replaces any earlier chunks, so it is safe to re-run.
 */
export async function indexItem(item: { id: string; user_id: string; title: string; text: string }): Promise<number> {
  const db = adminClient();
  const chunks = chunkText(item.text).map((c) => `${item.title}\n\n${c}`);
  const embeddings = chunks.length ? await embed(chunks, 'RETRIEVAL_DOCUMENT', 'index') : [];

  const { error: deleteError } = await db.from('chunks').delete().eq('item_id', item.id).eq('user_id', item.user_id);
  if (deleteError) throw deleteError;
  if (!chunks.length) return 0;

  const { error } = await db.from('chunks').insert(
    chunks.map((text, i) => ({ item_id: item.id, user_id: item.user_id, text, embedding: embeddings[i] })),
  );
  if (error) throw error;
  return chunks.length;
}
