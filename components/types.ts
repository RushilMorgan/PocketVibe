/** API response shapes the pages consume (mirrors lib/ without importing server code). */
import type { ItemOutputRow, ItemRow } from '@/lib/supabase/database.types';

export type Item = ItemRow & { outputs: ItemOutputRow[] };

/** GET /api/feed. lib/items/feed.ts is pure (types only), so it's safe to share. */
export type { Feed, FeedFilter, FeedItem, FeedState, Streak, UpNextReason, WeekProgress } from '@/lib/items/feed';

export interface Topic {
  id: string;
  name: string;
  weight: number;
  itemCount: number;
  lastSeenAt: string;
}

export interface SimilarItem {
  id: string;
  title: string | null;
  kind: ItemRow['kind'];
  url: string;
  thumbnail_url: string | null;
  similarity: number;
}

export interface ChatSource {
  n: number;
  itemId: string;
  title: string;
}

export const KIND_LABEL: Record<NonNullable<ItemRow['kind']>, string> = {
  recipe: '🍳 Recipe',
  tech: '🧠 Tech',
  news: '📰 News',
  other: '📎 Other',
};
