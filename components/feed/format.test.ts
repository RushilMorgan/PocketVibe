import { describe, expect, it } from 'vitest';
import type { FeedItem } from '@/components/types';
import { formatDuration, metaLine, scoreLabel, shortAgo, tileLabel } from './format';

const NOW = Date.parse('2026-11-11T12:00:00Z');

function item(over: Partial<FeedItem>): FeedItem {
  return {
    id: 'a',
    url: 'https://www.example.com/post',
    source: 'article',
    kind: 'tech',
    title: 'T',
    status: 'done',
    error: null,
    summary: null,
    thumbnail_url: null,
    duration_seconds: null,
    snoozed_until: null,
    related: null,
    created_at: '2026-11-11T09:00:00Z',
    state: 'read',
    thumbnailShape: 'landscape',
    opened: true,
    openedAt: null,
    lessonId: null,
    bestScore: null,
    topTopic: null,
    readMinutes: null,
    ingredientCount: null,
    reviewDueAt: null,
    reviewFormat: null,
    ...over,
  };
}

describe('feed format', () => {
  it('formats durations', () => {
    expect(formatDuration(58)).toBe('0:58');
    expect(formatDuration(724)).toBe('12:04');
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
  });

  it('formats short ages', () => {
    expect(shortAgo('2026-11-11T11:59:30Z', NOW)).toBe('now');
    expect(shortAgo('2026-11-11T11:55:00Z', NOW)).toBe('5m');
    expect(shortAgo('2026-11-11T09:00:00Z', NOW)).toBe('3h');
    expect(shortAgo('2026-11-09T12:00:00Z', NOW)).toBe('2d');
    expect(shortAgo('2026-10-28T12:00:00Z', NOW)).toBe('2w');
    expect(shortAgo('2026-08-01T12:00:00Z', NOW)).toBe('3mo');
  });

  it('labels scores', () => {
    expect(scoreLabel(0.6)).toBe('60%');
    expect(scoreLabel(null)).toBeNull();
  });

  it('writes the card meta line per state', () => {
    expect(metaLine(item({ state: 'working', source: 'youtube' }), NOW)).toBe('Watching…');
    expect(metaLine(item({ state: 'working' }), NOW)).toBe('Reading…');
    expect(metaLine(item({ state: 'lesson_ready' }), NOW)).toBe('Lesson ready · 3h');
    expect(metaLine(item({ state: 'played', bestScore: 0.4 }), NOW)).toBe('Played · 40% · 3h');
    expect(metaLine(item({ state: 'read', kind: 'recipe', ingredientCount: 6 }), NOW)).toBe('6 ingredients · 3h');
  });

  it('labels fallback tiles by topic, then site', () => {
    expect(tileLabel({ topTopic: 'AI', url: 'https://x.com' })).toBe('AI');
    expect(tileLabel({ topTopic: null, url: 'https://www.example.com/a' })).toBe('example.com');
  });
});
