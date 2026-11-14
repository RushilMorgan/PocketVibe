import 'server-only';
import { classify } from '@/lib/ai/classify';
import { withUsage } from '@/lib/ai/usage';
import { env } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { HttpError } from '@/lib/http';
import { getItem, usedToday } from '@/lib/items/service';
import { getPromptContext } from '@/lib/profile';
import type { ItemOutputRow } from '@/lib/supabase/database.types';
import { adminClient } from '@/lib/supabase/server';
import { getSmartModel } from '@/lib/users';
import { generateWhatIf } from './generate';
import { cleanScenario, MAX_EXTRA, sameScenario, type WhatIf, type WhatIfOrigin } from './schema';

type Stored = Pick<WhatIf, 'scenario' | 'origin'>;
const stored = (o: ItemOutputRow) => o.content as unknown as Stored;

async function write(
  userId: string,
  itemId: string,
  input: { title: string; text: string; scenario: string; origin: WhatIfOrigin },
): Promise<ItemOutputRow> {
  const [ctx, modelId] = await Promise.all([getPromptContext(userId), getSmartModel(userId)]);
  const content = await generateWhatIf({ ...input, ctx, modelId });
  const { data, error } = await adminClient()
    .from('item_outputs')
    .insert({ item_id: itemId, user_id: userId, type: 'whatif', content })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Job step: the what-if written with the save. Safe to re-run — if the save
 * already has its automatic one, nothing is written. Returns whether it has one.
 */
export async function ensureAutoWhatIf(
  userId: string,
  itemId: string,
  input: { title: string; text: string; scenario: string },
): Promise<boolean> {
  const { data: existing, error } = await adminClient()
    .from('item_outputs')
    .select('*')
    .eq('item_id', itemId)
    .eq('user_id', userId)
    .eq('type', 'whatif');
  if (error) throw error;
  if ((existing ?? []).some((o) => stored(o).origin === 'auto')) return true;
  await write(userId, itemId, { ...input, origin: 'auto' });
  return true;
}

export type WhatIfRequest = { origin: 'auto' } | { origin: 'other' | 'custom'; scenario: string };

/**
 * From the item page. 'auto' writes the save's own what-if when it has none
 * (Try again, or a save from before what-ifs existed). 'other' and 'custom'
 * add a scenario: at most MAX_EXTRA per save, each counted against the daily
 * save cap. Asking for a scenario the save already has returns that one.
 */
export async function addWhatIf(userId: string, itemId: string, req: WhatIfRequest): Promise<ItemOutputRow> {
  const item = await getItem(userId, itemId);
  if (!item.raw_text) throw new HttpError(409, "This one hasn't been read yet.");
  if (item.kind === 'recipe') throw new HttpError(400, 'Recipes have no what-if.');
  const text = item.raw_text;
  const title = item.title ?? item.url;
  const existing = item.outputs.filter((o) => o.type === 'whatif');

  return withUsage({ itemId }, async () => {
    if (req.origin === 'auto') {
      const auto = existing.find((o) => stored(o).origin === 'auto');
      if (auto) return auto;
      let scenario = item.what_if;
      if (!scenario) {
        // Saved before what-ifs: ask the classifier for a scenario now.
        scenario = (await classify(text, await getPromptContext(userId))).what_if;
        if (!scenario) throw new HttpError(422, "There's no obvious what-if for this one. Try writing your own.");
        const { error } = await adminClient().from('items').update({ what_if: scenario }).eq('id', itemId).eq('user_id', userId);
        if (error) throw error;
      }
      return write(userId, itemId, { title, text, scenario, origin: 'auto' });
    }

    const scenario = cleanScenario(req.scenario);
    if (!scenario) throw new HttpError(400, 'Write the what-if as a short question.');
    const same = existing.find((o) => sameScenario(stored(o).scenario, scenario));
    if (same) return same;
    if (existing.filter((o) => stored(o).origin !== 'auto').length >= MAX_EXTRA) {
      throw new HttpError(409, `That's the limit of ${MAX_EXTRA} extra what-ifs for one save.`);
    }
    if ((await usedToday(userId)) >= env().DAILY_ITEM_CAP) {
      throw new HttpError(429, "That's today's limit. Try it again tomorrow.");
    }
    const output = await write(userId, itemId, { title, text, scenario, origin: req.origin });
    await logEvent(userId, 'whatif_scenario', { itemId });
    return output;
  });
}
