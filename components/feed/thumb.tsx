'use client';

import { useEffect, useState } from 'react';
import { api } from '@/components/api';
import type { FeedItem } from '@/components/types';
import { displayTopic } from '@/lib/topic-view';
import { tileLabel } from './format';

const TILE: Record<NonNullable<FeedItem['kind']> | 'none', { bg: string; icon: string }> = {
  recipe: { bg: 'bg-tile-recipe', icon: '🍳' },
  tech: { bg: 'bg-tile-tech', icon: '🧠' },
  news: { bg: 'bg-tile-news', icon: '📰' },
  other: { bg: 'bg-tile-other', icon: '📎' },
  none: { bg: 'bg-tile-other', icon: '🔗' },
};

/** What Thumb needs: a feed item, an item page's item, or a similar-saves row. */
export type ThumbItem = Pick<FeedItem, 'id' | 'thumbnail_url' | 'kind' | 'url'> & { topTopic?: string | null };

/**
 * The item's own preview image, filling its box. If the image fails (TikTok
 * links expire) it asks the server once for a fresh one and otherwise shows a
 * coloured tile for the kind with the item's top topic.
 */
export function Thumb({
  item,
  eager,
  position,
  compact,
}: {
  item: ThumbItem;
  eager?: boolean;
  position?: string;
  /** Small boxes (collages): the fallback tile shows just its emoji. */
  compact?: boolean;
}) {
  const [src, setSrc] = useState(item.thumbnail_url);
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => setSrc(item.thumbnail_url), [item.thumbnail_url]);

  async function onError() {
    setSrc(null);
    if (refreshed) return;
    setRefreshed(true);
    try {
      const { thumbnailUrl } = await api<{ thumbnailUrl: string | null }>(`/api/items/${item.id}/thumbnail`, { method: 'POST' });
      if (thumbnailUrl && thumbnailUrl !== item.thumbnail_url) setSrc(thumbnailUrl);
    } catch {
      // Keep the tile.
    }
  }

  if (!src) {
    const tile = TILE[item.kind ?? 'none'];
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-white ${tile.bg}`}>
        <span aria-hidden className={compact ? 'text-2xl' : 'text-4xl'}>
          {tile.icon}
        </span>
        {!compact && <span className="line-clamp-2 text-sm font-semibold leading-tight">{item.topTopic ? displayTopic(item.topTopic) : tileLabel(item)}</span>}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote originals, no image optimisation (docs/saves-redesign.md A1)
    <img
      src={src}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={onError}
      className="h-full w-full object-cover"
      style={position ? { objectPosition: position } : undefined}
    />
  );
}
