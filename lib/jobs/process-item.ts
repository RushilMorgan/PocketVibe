import 'server-only';
import { NonRetriableError } from 'inngest';
import { classify } from '@/lib/ai/classify';
import { fetchContent, UnreadableError } from '@/lib/items/fetch';
import { markFailed } from '@/lib/items/service';
import { getPromptContext } from '@/lib/profile';
import { adminClient } from '@/lib/supabase/server';
import { inngest, itemQueued } from './client';

/**
 * Shared link → useful version. Each step is retried on its own by Inngest, so
 * a flaky Gemini call doesn't redo the fetch.
 *
 * Phase 1 pipeline: fetch → classify → handle → index → notify.
 * Handle/index/notify land in the next build step.
 */
export const processItem = inngest.createFunction(
  {
    id: 'process-item',
    triggers: [itemQueued],
    retries: 2,
    concurrency: { key: 'event.data.userId', limit: 3 },
    onFailure: async ({ event, error }) => {
      const { itemId } = event.data.event.data as { itemId: string };
      // NonRetriable messages were written for the user; anything else wasn't.
      await markFailed(itemId, error.name === 'NonRetriableError' ? error.message : "Couldn't read that one.");
    },
  },
  async ({ event, step }) => {
    const { itemId, userId } = event.data;
    const db = adminClient();

    const item = await step.run('start', async () => {
      const { data, error } = await db
        .from('items')
        .update({ status: 'processing', error: null })
        .eq('id', itemId)
        .eq('user_id', userId)
        .select('id, url, source, raw_text')
        .single();
      if (error) throw error;
      return data;
    });

    const rawText = await step.run('fetch', async () => {
      if (item.raw_text) return item.raw_text; // retry after a later step failed
      try {
        const text = await fetchContent(item.url, item.source);
        const { error } = await db.from('items').update({ raw_text: text }).eq('id', itemId);
        if (error) throw error;
        return text;
      } catch (err) {
        if (err instanceof UnreadableError) throw new NonRetriableError(err.message);
        throw err;
      }
    });

    const meta = await step.run('classify', async () => {
      const result = await classify(rawText, await getPromptContext(userId));
      const { error } = await db.from('items').update({ kind: result.kind, title: result.title }).eq('id', itemId);
      if (error) throw error;
      return result;
    });

    await step.run('finish', async () => {
      const { error } = await db.from('items').update({ status: 'done' }).eq('id', itemId);
      if (error) throw error;
    });

    return { itemId, kind: meta.kind, tags: meta.tags };
  },
);

export const functions = [processItem];
