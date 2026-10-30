import 'server-only';
import { NonRetriableError } from 'inngest';
import { classify } from '@/lib/ai/classify';
import { createDiagram } from '@/lib/diagrams/generate';
import { createLesson, unplayedLesson } from '@/lib/lessons/service';
import { explain } from '@/lib/handlers/explainer';
import { extractRecipe } from '@/lib/handlers/recipe';
import { indexItem } from '@/lib/index/index-item';
import { fetchContent, UnreadableError } from '@/lib/items/fetch';
import { markFailed, saveOutput } from '@/lib/items/service';
import { notifyUser } from '@/lib/notify';
import { getPromptContext, recordItemTopics } from '@/lib/profile';
import type { ItemRow } from '@/lib/supabase/database.types';
import { adminClient } from '@/lib/supabase/server';
import { inngest, itemQueued } from './client';

/**
 * Shared link → useful version: fetch → classify → handle → (diagram) → index
 * → notify → (lesson).
 * Each step is retried on its own by Inngest, so a flaky Gemini call doesn't
 * redo the work before it, and every step is safe to re-run.
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
    const update = async (fields: Partial<ItemRow>) => {
      const { error } = await db.from('items').update(fields).eq('id', itemId).eq('user_id', userId);
      if (error) throw error;
    };

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
      if (item.raw_text) return item.raw_text; // Retry after a later step failed.
      try {
        const text = await fetchContent(item.url, item.source);
        await update({ raw_text: text });
        return text;
      } catch (err) {
        if (err instanceof UnreadableError) throw new NonRetriableError(err.message);
        throw err;
      }
    });

    const meta = await step.run('classify', async () => {
      const result = await classify(rawText, await getPromptContext(userId));
      await update({ kind: result.kind, title: result.title });
      return result;
    });

    await step.run('handle', async () => {
      const ctx = await getPromptContext(userId);
      if (meta.kind === 'recipe') {
        const recipe = await extractRecipe({
          url: item.source === 'youtube' ? item.url : undefined,
          text: rawText,
          tone: ctx.tone,
        });
        await saveOutput(userId, itemId, 'recipe', recipe);
        await update({ summary: recipe.description });
      } else {
        const explainer = await explain(rawText, ctx);
        await saveOutput(userId, itemId, 'explainer', explainer);
        await update({ summary: explainer.lines.join('\n') });
      }
    });

    // SPEC Phase 2: tech items that explain a system get a diagram automatically.
    // Best-effort — a diagram that won't render leaves the item text-only.
    if (meta.kind === 'tech' && meta.has_structure) {
      await step.run('diagram', async () => {
        try {
          return Boolean(await createDiagram(userId, itemId, rawText, await getPromptContext(userId)));
        } catch (err) {
          console.error('diagram failed, staying text-only', err);
          return false;
        }
      });
    }

    await step.run('index',() => indexItem({ id: itemId, user_id: userId, title: meta.title, text: rawText }));
    await step.run('topics', () => recordItemTopics(userId, itemId, meta.tags));
    await step.run('finish', () => update({ status: 'done' }));

    await step.run('notify', () =>
      notifyUser(userId, {
        title: meta.kind === 'recipe' ? 'Your recipe is ready 🍳' : 'Your explainer is ready',
        body: meta.title,
        url: `/items/${itemId}`,
      }),
    );

    // Pre-write a lesson so Play opens instantly. After notify, so it never
    // delays the explainer; best-effort, Play can still generate on demand.
    if (meta.kind !== 'recipe') {
      await step.run('lesson', async () => {
        try {
          if (await unplayedLesson(userId, itemId)) return null;
          return await createLesson(userId, itemId);
        } catch (err) {
          console.error('lesson pre-generation failed', err);
          return null;
        }
      });
    }

    return { itemId, kind: meta.kind, tags: meta.tags };
  },
);

export const functions = [processItem];
