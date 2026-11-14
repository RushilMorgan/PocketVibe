import 'server-only';
import { z } from 'zod';
import type { Recipe } from '@/lib/handlers/schemas';
import { HttpError } from '@/lib/http';
import { adminClient } from '@/lib/supabase/server';
import { totalMinutes, type Cook, type RecipeSummary } from './view';

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const cookRequest = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

/** Every finished recipe save, shaped for the Recipes page (search and filters run in the browser). */
export async function listRecipes(userId: string): Promise<RecipeSummary[]> {
  const db = adminClient();
  const [items, outputs, cooks] = await Promise.all([
    db
      .from('items')
      .select('id, title, url, source, thumbnail_url, created_at, cook_list_at')
      .eq('user_id', userId)
      .eq('kind', 'recipe')
      .eq('status', 'done'),
    db.from('item_outputs').select('item_id, content').eq('user_id', userId).eq('type', 'recipe'),
    db.from('cooks').select('item_id, rating, created_at').eq('user_id', userId).order('created_at'),
  ]);
  for (const r of [items, outputs, cooks]) if (r.error) throw r.error;

  const cardFor = new Map((outputs.data ?? []).map((o) => [o.item_id, o.content as unknown as Recipe]));
  const cooksFor = new Map<string, { rating: number | null; created_at: string }[]>();
  for (const c of cooks.data ?? []) cooksFor.set(c.item_id, [...(cooksFor.get(c.item_id) ?? []), c]);

  return (items.data ?? []).flatMap((item) => {
    const card = cardFor.get(item.id);
    if (!card) return [];
    const log = cooksFor.get(item.id) ?? [];
    return [
      {
        id: item.id,
        title: item.title ?? card.title,
        url: item.url,
        source: item.source,
        thumbnail_url: item.thumbnail_url,
        created_at: item.created_at,
        description: card.description ?? '',
        servings: card.servings,
        totalMinutes: totalMinutes(card),
        ingredientCount: card.ingredients?.length ?? 0,
        stepCount: card.steps?.length ?? 0,
        tags: (card.tags ?? []).map((t) => t.toLowerCase()),
        ingredients: (card.ingredients ?? []).map((i) => i.name.toLowerCase()),
        wantToCookAt: item.cook_list_at,
        cookedCount: log.length,
        lastCookedAt: log.at(-1)?.created_at ?? null,
        rating: log.findLast((c) => c.rating !== null)?.rating ?? null,
      },
    ];
  });
}

async function recipeItem(userId: string, itemId: string): Promise<void> {
  if (!isUuid(itemId)) throw new HttpError(404, 'Recipe not found.');
  const { data, error } = await adminClient().from('items').select('kind').eq('id', itemId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Recipe not found.');
  if (data.kind !== 'recipe') throw new HttpError(400, "That save isn't a recipe.");
}

/** Puts a recipe on the Want to cook list, or takes it off. Returns when it was added (null = off). */
export async function setWantToCook(userId: string, itemId: string, on: boolean, now = new Date()): Promise<string | null> {
  await recipeItem(userId, itemId);
  const cook_list_at = on ? now.toISOString() : null;
  const { error } = await adminClient().from('items').update({ cook_list_at }).eq('id', itemId).eq('user_id', userId);
  if (error) throw error;
  return cook_list_at;
}

/** The times this recipe was cooked, newest first. */
export async function cooksFor(userId: string, itemId: string): Promise<Cook[]> {
  if (!isUuid(itemId)) return [];
  const { data, error } = await adminClient()
    .from('cooks')
    .select('id, rating, note, created_at')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** "I cooked this": logs it with an optional rating and note, and takes it off the Want to cook list. */
export async function logCook(userId: string, itemId: string, input: z.infer<typeof cookRequest>): Promise<Cook> {
  await recipeItem(userId, itemId);
  const db = adminClient();
  const { data, error } = await db
    .from('cooks')
    .insert({ user_id: userId, item_id: itemId, rating: input.rating ?? null, note: input.note || null })
    .select('id, rating, note, created_at')
    .single();
  if (error) throw error;
  const { error: listError } = await db.from('items').update({ cook_list_at: null }).eq('id', itemId).eq('user_id', userId);
  if (listError) throw listError;
  return data;
}
