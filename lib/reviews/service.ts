import 'server-only';
import { z } from 'zod';
import { generateJson } from '@/lib/ai/gemini';
import { withUsage } from '@/lib/ai/usage';
import { prompt } from '@/lib/ai/prompts';
import { HttpError } from '@/lib/http';
import { getPromptContext } from '@/lib/profile';
import { adminClient } from '@/lib/supabase/server';
import type { ItemRow, RelatedSave, ReviewFormat, ReviewRating } from '@/lib/supabase/database.types';
import { nextReviewLabel, reviewPlan, type ReviewLog } from './schedule';
import type { CardSave, ReviewCard } from './types';

export type { ReviewCard } from './types';

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);


const ITEM_COLS = 'id, title, url, kind, thumbnail_url, created_at, summary, related, status';

async function loadSave(userId: string, itemId: string) {
  const db = adminClient();
  const [{ data: item, error }, { data: explainer }] = await Promise.all([
    db.from('items').select(ITEM_COLS).eq('id', itemId).eq('user_id', userId).maybeSingle(),
    db
      .from('item_outputs')
      .select('content')
      .eq('item_id', itemId)
      .eq('user_id', userId)
      .eq('type', 'explainer')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) throw error;
  if (!item) throw new HttpError(404, 'Save not found.');
  const lines = (explainer?.content as { lines?: unknown } | null)?.lines;
  const ideas = Array.isArray(lines) ? lines.filter((l): l is string => typeof l === 'string') : (item.summary?.split('\n') ?? []);
  return { item, ideas };
}

async function history(userId: string, itemId: string): Promise<{ firstOpenedAt: string | null; reviews: ReviewLog[] }> {
  const db = adminClient();
  const [{ data: opened, error }, { data: reviews, error: reviewsError }] = await Promise.all([
    db.from('events').select('created_at').eq('user_id', userId).eq('item_id', itemId).eq('type', 'opened').order('created_at').limit(1),
    db.from('reviews').select('rating, format, created_at').eq('user_id', userId).eq('item_id', itemId),
  ]);
  if (error) throw error;
  if (reviewsError) throw reviewsError;
  return { firstOpenedAt: opened?.[0]?.created_at ?? null, reviews: reviews ?? [] };
}

function ageLabel(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / (24 * 3600_000));
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
}

/**
 * The card to show for a save: recall (its key ideas), or Then and now (how it
 * connects to its related save). The connection note is written once by the
 * fast model and cached on items.related.note. Works even when nothing is due,
 * so the card can be opened from anywhere.
 */
export async function getReviewCard(userId: string, itemId: string, now = new Date()): Promise<ReviewCard> {
  if (!isUuid(itemId)) throw new HttpError(404, 'Save not found.');
  const [{ item, ideas }, past] = await Promise.all([loadSave(userId, itemId), history(userId, itemId)]);
  if (item.status !== 'done') throw new HttpError(409, "This one isn't ready yet.");
  const related = item.related as RelatedSave | null;
  const plan = reviewPlan({
    firstOpenedAt: past.firstOpenedAt ?? item.created_at,
    reviews: past.reviews,
    hasRelated: Boolean(related),
    isRecipe: false,
  });
  const save: CardSave = pick(item, ideas);
  const format = plan?.format ?? 'recall';
  if (format === 'recall' || !related) return { format: 'recall', step: plan?.step ?? 0, save };

  try {
    const other = await loadSave(userId, related.itemId);
    const connection = related.note?.lines?.length ? related.note.lines : await withUsage({ itemId }, () => writeConnection(userId, item, ideas, other, now));
    if (!related.note?.lines?.length) {
      await adminClient()
        .from('items')
        .update({ related: { ...related, note: { lines: connection } } })
        .eq('id', itemId)
        .eq('user_id', userId);
    }
    return { format: 'connect', step: plan?.step ?? 0, save, other: pick(other.item, other.ideas), connection };
  } catch (err) {
    // The connection is a nicety: fall back to a plain recall card.
    console.error('then-and-now failed, showing recall', err);
    return { format: 'recall', step: plan?.step ?? 0, save };
  }
}

function pick(item: Pick<ItemRow, 'id' | 'title' | 'url' | 'kind' | 'thumbnail_url' | 'created_at'>, ideas: string[]): CardSave {
  return { id: item.id, title: item.title, url: item.url, kind: item.kind, thumbnail_url: item.thumbnail_url, created_at: item.created_at, ideas };
}

const connection = z.object({ lines: z.array(z.string().min(1)).min(2).max(3) });

async function writeConnection(
  userId: string,
  a: { title: string | null; created_at: string },
  aIdeas: string[],
  b: { item: { title: string | null; created_at: string }; ideas: string[] },
  now: Date,
): Promise<string[]> {
  // Older save first, so "then" and "now" read in order.
  const [then, next] =
    a.created_at <= b.item.created_at ? [{ ...a, ideas: aIdeas }, { ...b.item, ideas: b.ideas }] : [{ ...b.item, ideas: b.ideas }, { ...a, ideas: aIdeas }];
  const instructions = await prompt('review-connect', {
    ...(await getPromptContext(userId)),
    then_age: ageLabel(then.created_at, now),
    then_title: then.title ?? 'Untitled',
    then_text: then.ideas.join('\n'),
    now_age: ageLabel(next.created_at, now),
    now_title: next.title ?? 'Untitled',
    now_text: next.ideas.join('\n'),
  });
  const result = await generateJson(connection, [{ text: instructions }], { feature: 'review' });
  return result.lines;
}

/** Saves a rating and says when the next card is due. */
export async function recordReview(
  userId: string,
  itemId: string,
  format: ReviewFormat,
  rating: ReviewRating,
  now = new Date(),
): Promise<{ next: string }> {
  if (!isUuid(itemId)) throw new HttpError(404, 'Save not found.');
  const db = adminClient();
  const { data: item, error } = await db.from('items').select('id, kind, related, created_at').eq('id', itemId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!item) throw new HttpError(404, 'Save not found.');
  const { error: insertError } = await db
    .from('reviews')
    .insert({ user_id: userId, item_id: itemId, format, rating, created_at: now.toISOString() });
  if (insertError) throw insertError;

  const past = await history(userId, itemId);
  const plan = reviewPlan({
    firstOpenedAt: past.firstOpenedAt ?? item.created_at,
    reviews: past.reviews,
    hasRelated: Boolean(item.related),
    isRecipe: item.kind === 'recipe',
  });
  return { next: nextReviewLabel(plan, now) };
}
