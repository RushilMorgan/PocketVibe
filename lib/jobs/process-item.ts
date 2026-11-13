import 'server-only';
import { NonRetriableError } from 'inngest';
import { classify } from '@/lib/ai/classify';
import { createDiagram } from '@/lib/diagrams/generate';
import { explain } from '@/lib/handlers/explainer';
import { extractRecipe } from '@/lib/handlers/recipe';
import { recipeText } from '@/lib/handlers/schemas';
import { indexItem } from '@/lib/index/index-item';
import { linkRelated } from '@/lib/items/actions';
import { fetchContent, findThumbnail, UnreadableError } from '@/lib/items/fetch';
import { markFailed, saveOutput } from '@/lib/items/service';
import { notifyUser } from '@/lib/notify';
import { readyMessage } from '@/lib/nudges/ready';
import { readyNudgeId } from '@/lib/nudges/service';
import { getPromptContext, recordItemTopics } from '@/lib/profile';
import type { ItemRow } from '@/lib/supabase/database.types';
import { adminClient } from '@/lib/supabase/server';
import { getSmartModel } from '@/lib/users';
import { pendingMainWhatIf, setMainScenario, writeWhatIf } from '@/lib/whatif/service';
import { inngest, itemQueued } from './client';

/**
 * Shared link → useful version: fetch → classify → handle → (diagram) → index
 * → notify → (what-if card). Lessons are no longer pre-written: Play writes
 * one on request (docs/what-if.md, Part C).
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
        .select('id, url, source, raw_text, thumbnail_url')
        .single();
      if (error) throw error;
      return data;
    });

    const rawText = await step.run('fetch', async () => {
      if (item.raw_text) return item.raw_text; // Retry after a later step failed.
      try {
        const { text, durationSeconds } = await fetchContent(item.url, item.source);
        await update({ raw_text: text, duration_seconds: durationSeconds });
        return text;
      } catch (err) {
        if (err instanceof UnreadableError) throw new NonRetriableError(err.message);
        throw err;
      }
    });

    // Best-effort: a save without a preview image falls back to a kind tile.
    if (!item.thumbnail_url) {
      await step.run('thumbnail', async () => {
        try {
          const thumbnail_url = await findThumbnail(item.url, item.source);
          if (thumbnail_url) await update({ thumbnail_url });
          return Boolean(thumbnail_url);
        } catch (err) {
          console.error('thumbnail failed, item keeps the kind tile', err);
          return false;
        }
      });
    }

    const meta = await step.run('classify', async () => {
      const result = await classify(rawText, await getPromptContext(userId));
      await update({ kind: result.kind, title: result.title });
      // Recorded now so the ready push can offer it; the card is written last.
      await setMainScenario(userId, itemId, result.what_if);
      return result;
    });

    // Returns the text to index: for recipes the clean card, not the noisy page.
    const indexText = await step.run('handle', async () => {
      const ctx = await getPromptContext(userId);
      if (meta.kind === 'recipe') {
        const recipe = await extractRecipe({
          url: item.source === 'youtube' ? item.url : undefined,
          text: rawText,
          tone: ctx.tone,
        });
        await saveOutput(userId, itemId, 'recipe', recipe);
        await update({ summary: recipe.description });
        return recipeText(recipe);
      }
      const explainer = await explain(rawText, ctx, 'normal', await getSmartModel(userId));
      await saveOutput(userId, itemId, 'explainer', explainer);
      await update({ summary: explainer.lines.join('\n') });
      return rawText;
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

    await step.run('index', () => indexItem({ id: itemId, user_id: userId, title: meta.title, text: indexText }));
    // Best-effort, after index (it compares this item's chunks): "Connects to …" for the push and feed.
    const related = await step.run('related', async () => {
      try {
        return await linkRelated(userId, itemId, meta.title);
      } catch (err) {
        console.error('related failed, item stays unlinked', err);
        return null;
      }
    });
    await step.run('topics', () => recordItemTopics(userId, itemId, meta.tags));
    await step.run('finish', () => update({ status: 'done' }));

    // Rich push with the thumbnail and Read / Play buttons, logged as a 'ready' nudge for tap stats.
    // Best-effort: the item is already done, so a push problem must never fail it.
    await step.run('notify', async () => {
      try {
        return await sendReady();
      } catch (err) {
        console.error('ready push failed', err);
        return 0;
      }
    });

    async function sendReady(): Promise<number> {
      const [{ data: row, error }, { data: recipe }] = await Promise.all([
        db.from('items').select('summary, thumbnail_url').eq('id', itemId).eq('user_id', userId).single(),
        db
          .from('item_outputs')
          .select('ingredients:content->ingredients')
          .eq('item_id', itemId)
          .eq('user_id', userId)
          .eq('type', 'recipe')
          .limit(1)
          .maybeSingle(),
      ]);
      if (error) throw error;
      const ingredients = (recipe as { ingredients?: unknown } | null)?.ingredients;
      const nudgeId = await readyNudgeId(userId, itemId);
      return notifyUser(
        userId,
        readyMessage({
          itemId,
          nudgeId,
          title: meta.title,
          kind: meta.kind,
          firstLine: row.summary?.split('\n')[0] ?? null,
          ingredientCount: Array.isArray(ingredients) ? ingredients.length : null,
          thumbnailUrl: row.thumbnail_url,
          relatedTitle: related?.title ?? null,
          whatIf: meta.what_if,
        }),
      );
    }

    // The what-if card: Search + the smart model, so it comes after the push
    // rather than delaying it (the item page shows it as "thinking" meanwhile).
    // Best-effort: a card that fails is saved as failed and offers Try again.
    if (meta.what_if) {
      await step.run('whatif', async () => {
        const id = await pendingMainWhatIf(userId, itemId);
        return id ? (await writeWhatIf(userId, id)).status : 'done';
      });
    }

    return { itemId, kind: meta.kind, tags: meta.tags };
  },
);
