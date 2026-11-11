import type { FeedItem } from '@/components/types';

/** 58 → "0:58", 724 → "12:04". */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Compact age for cards: "now", "5m", "3h", "2d", "1w", "4mo", "1y". */
export function shortAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  if (s < 30 * 86400) return `${Math.floor(s / (7 * 86400))}w`;
  if (s < 365 * 86400) return `${Math.floor(s / (30 * 86400))}mo`;
  return `${Math.floor(s / (365 * 86400))}y`;
}

export function scoreLabel(score: number | null): string | null {
  return score === null ? null : `${Math.round(score * 100)}%`;
}

/** The small line under a card's title. */
export function metaLine(item: FeedItem, now = Date.now()): string {
  const age = shortAgo(item.created_at, now);
  switch (item.state) {
    case 'working':
      return item.source === 'youtube' || item.source === 'tiktok' ? 'Watching…' : 'Reading…';
    case 'failed':
      return "Couldn't read it · tap to retry";
    case 'new':
      return item.kind === 'recipe' && item.ingredientCount ? `New · ${item.ingredientCount} ingredients · ${age}` : `New · ${age}`;
    case 'lesson_ready':
      return `Lesson ready · ${age}`;
    case 'played':
      return `Played · ${scoreLabel(item.bestScore)} · ${age}`;
    case 'mastered':
      return `Mastered · ${age}`;
    case 'read':
      return item.ingredientCount ? `${item.ingredientCount} ingredients · ${age}` : `Read · ${age}`;
  }
}

/** "AI SaaS" for the fallback tile; falls back to the site name. */
export function tileLabel(item: Pick<FeedItem, 'topTopic' | 'url'>): string {
  if (item.topTopic) return item.topTopic;
  try {
    return new URL(item.url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
