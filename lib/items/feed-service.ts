import 'server-only';
import { HttpError } from '@/lib/http';
import { adminClient } from '@/lib/supabase/server';
import { buildFeed, SNOOZE_DAYS, type Feed, type FeedInput, type FeedOptions } from './feed';
import { DEFAULT_TZ } from '@/lib/time';
import { findThumbnail } from './fetch';

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const ITEM_COLUMNS =
  'id, url, source, kind, title, status, error, summary, thumbnail_url, duration_seconds, snoozed_until, related, created_at';
/** PostgREST returns at most this many rows per request. */
const PAGE = 1000;

/** The saves feed for one user: rows from several tables, shaped by lib/items/feed.ts. */
export async function getFeed(userId: string, opts: FeedOptions, now = new Date()): Promise<Feed> {
  const db = adminClient();
  const [items, events, lessons, recipes, itemTopics, topics, reviews, whatifs, user] = await Promise.all([
    db.from('items').select(ITEM_COLUMNS).eq('user_id', userId),
    allEvents(userId),
    db.from('item_outputs').select('id, item_id, created_at').eq('user_id', userId).eq('type', 'lesson'),
    db.from('item_outputs').select('item_id, ingredients:content->ingredients').eq('user_id', userId).eq('type', 'recipe'),
    db.from('item_topics').select('item_id, topic_id').eq('user_id', userId),
    db.from('topics').select('id, name, weight').eq('user_id', userId),
    db.from('reviews').select('item_id, rating, format, created_at').eq('user_id', userId),
    db.from('whatifs').select('item_id, kind, status, opened_at').eq('user_id', userId),
    db.from('users').select('timezone').eq('id', userId).maybeSingle(),
  ]);
  for (const r of [items, lessons, recipes, itemTopics, topics, reviews, whatifs, user]) if (r.error) throw r.error;

  const input: FeedInput = {
    items: items.data ?? [],
    events,
    lessons: lessons.data ?? [],
    recipes: ((recipes.data ?? []) as { item_id: string; ingredients: unknown }[]).map((r) => ({
      item_id: r.item_id,
      ingredientCount: Array.isArray(r.ingredients) ? r.ingredients.length : 0,
    })),
    itemTopics: itemTopics.data ?? [],
    topics: topics.data ?? [],
    reviews: reviews.data ?? [],
    whatifs: whatifs.data ?? [],
  };
  return buildFeed(input, opts, now, user.data?.timezone ?? DEFAULT_TZ);
}

/** Every event the feed uses, paged past PostgREST's row cap so streaks stay right as history grows. */
async function allEvents(userId: string): Promise<FeedInput['events']> {
  const db = adminClient();
  const out: FeedInput['events'] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('events')
      .select('item_id, type, value, created_at')
      .eq('user_id', userId)
      .in('type', ['saved', 'opened', 'played', 'score'])
      .order('created_at')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** "Not now" on the Up next card: hides the item from it for a few days, on every device. */
export async function snoozeItem(userId: string, itemId: string, now = new Date()): Promise<string> {
  if (!isUuid(itemId)) throw new HttpError(404, 'Item not found.');
  const until = new Date(now.getTime() + SNOOZE_DAYS * 24 * 3600_000).toISOString();
  const { data, error } = await adminClient()
    .from('items')
    .update({ snoozed_until: until })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Item not found.');
  return until;
}

/**
 * Looks the preview image up again: the feed calls this once when a card's
 * image fails to load (TikTok CDN links expire). Null if none can be found,
 * in which case the stored link is cleared and the card keeps its kind tile.
 */
export async function refreshThumbnail(userId: string, itemId: string): Promise<string | null> {
  if (!isUuid(itemId)) throw new HttpError(404, 'Item not found.');
  const db = adminClient();
  const { data: item, error } = await db.from('items').select('url, source').eq('id', itemId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!item) throw new HttpError(404, 'Item not found.');
  const thumbnail_url = await findThumbnail(item.url, item.source).catch((err) => {
    console.error('thumbnail refresh failed', err);
    return null;
  });
  const { error: updateError } = await db.from('items').update({ thumbnail_url }).eq('id', itemId).eq('user_id', userId);
  if (updateError) throw updateError;
  return thumbnail_url;
}
