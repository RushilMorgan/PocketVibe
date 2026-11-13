import { describe, expect, it } from 'vitest';
import {
  activityDays,
  buildFeed,
  feedItems,
  feedState,
  pickUpNext,
  readMinutes,
  streak,
  thumbnailShape,
  weekProgress,
  weekStart,
  type FeedInput,
  type FeedSourceItem,
} from './feed';

// Wednesday 11 Nov 2026, 12:00 SAST. Its week starts Monday 9 Nov.
const NOW = new Date('2026-11-11T10:00:00Z');

function item(id: string, over: Partial<FeedSourceItem> = {}): FeedSourceItem {
  return {
    id,
    url: `https://youtube.com/shorts/${id}xxxxxx`,
    source: 'youtube',
    kind: 'tech',
    title: `Item ${id}`,
    status: 'done',
    error: null,
    summary: 'one two three',
    thumbnail_url: null,
    duration_seconds: null,
    snoozed_until: null,
    related: null,
    created_at: '2026-11-01T10:00:00Z',
    ...over,
  };
}

const empty: FeedInput = { items: [], events: [], lessons: [], recipes: [], itemTopics: [], topics: [], reviews: [], whatifs: [] };
const wi = (item_id: string, over: Partial<FeedInput['whatifs'][number]> = {}): FeedInput['whatifs'][number] => ({
  item_id,
  kind: 'main',
  status: 'done',
  opened_at: null,
  ...over,
});
const ev = (type: FeedInput['events'][number]['type'], created_at: string, item_id: string | null = null, value: number | null = null) => ({
  type,
  created_at,
  item_id,
  value,
});

describe('dates', () => {
  it("uses the user's time zone for today and the week", () => {
    // 22:30 UTC Tue = 00:30 Wed in Johannesburg, still Tue in London.
    const late = new Date('2026-11-10T22:30:00Z');
    expect(streak(['2026-11-10'], late, 'Europe/London')).toMatchObject({ days: 1, activeToday: true });
    expect(streak(['2026-11-10'], late, 'Africa/Johannesburg')).toMatchObject({ days: 1, activeToday: false });
    expect(weekProgress([ev('saved', '2026-11-08T23:30:00Z')], NOW, 'Europe/London').saveDays).toBe(0); // Sun in London
    expect(weekProgress([ev('saved', '2026-11-08T23:30:00Z')], NOW, 'Africa/Johannesburg').saveDays).toBe(1); // Mon in SA
  });

  it('finds the Monday of the week', () => {
    expect(weekStart('2026-11-11')).toBe('2026-11-09');
    expect(weekStart('2026-11-15')).toBe('2026-11-09');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
  });
});

describe('per item', () => {
  it('treats Shorts and TikTok as portrait', () => {
    expect(thumbnailShape({ url: 'https://youtube.com/shorts/abc123', source: 'youtube' })).toBe('portrait');
    expect(thumbnailShape({ url: 'https://vt.tiktok.com/x/', source: 'tiktok' })).toBe('portrait');
    expect(thumbnailShape({ url: 'https://youtube.com/watch?v=abc123', source: 'youtube' })).toBe('landscape');
    expect(thumbnailShape({ url: 'https://example.com/post', source: 'article' })).toBe('landscape');
  });

  it('estimates reading time', () => {
    expect(readMinutes(null)).toBeNull();
    expect(readMinutes('short')).toBe(1);
    expect(readMinutes(Array(600).fill('word').join(' '))).toBe(3);
  });

  it.each([
    [{ status: 'processing', opened: false, played: false, bestScore: null, lessonWaiting: false }, 'working'],
    [{ status: 'failed', opened: true, played: false, bestScore: null, lessonWaiting: false }, 'failed'],
    [{ status: 'done', opened: false, played: false, bestScore: null, lessonWaiting: true }, 'new'],
    [{ status: 'done', opened: true, played: false, bestScore: null, lessonWaiting: true }, 'lesson_ready'],
    [{ status: 'done', opened: true, played: false, bestScore: null, lessonWaiting: false }, 'read'],
    [{ status: 'done', opened: true, played: true, bestScore: 0.6, lessonWaiting: false }, 'played'],
    [{ status: 'done', opened: true, played: true, bestScore: 0.8, lessonWaiting: false }, 'mastered'],
  ] as const)('state %o → %s', (input, expected) => {
    expect(feedState(input)).toBe(expected);
  });
});

describe('feedItems', () => {
  it('derives lesson, score, opened and top topic', () => {
    const items = feedItems({
      ...empty,
      items: [item('a'), item('b', { created_at: '2026-11-02T10:00:00Z' })],
      events: [
        ev('opened', '2026-11-03T10:00:00Z', 'a'),
        ev('played', '2026-11-04T10:00:00Z', 'b'),
        ev('score', '2026-11-04T10:00:00Z', 'b', 0.5),
        ev('score', '2026-11-05T10:00:00Z', 'b', 0.9),
      ],
      lessons: [
        { id: 'la', item_id: 'a', created_at: '2026-11-01T11:00:00Z' },
        { id: 'lb', item_id: 'b', created_at: '2026-11-02T11:00:00Z' },
      ],
      itemTopics: [
        { item_id: 'a', topic_id: 't1' },
        { item_id: 'a', topic_id: 't2' },
      ],
      topics: [
        { id: 't1', name: 'AI', weight: 1 },
        { id: 't2', name: 'Databases', weight: 3 },
      ],
    });
    expect(items.map((i) => i.id)).toEqual(['b', 'a']); // newest first
    const [b, a] = items;
    expect(a).toMatchObject({ state: 'lesson_ready', lessonId: 'la', opened: true, topTopic: 'Databases', thumbnailShape: 'portrait' });
    expect(b).toMatchObject({ state: 'mastered', lessonId: null, bestScore: 0.9 });
  });

  it('offers a lesson written after the last play', () => {
    const [a] = feedItems({
      ...empty,
      items: [item('a')],
      events: [ev('played', '2026-11-04T10:00:00Z', 'a')],
      lessons: [{ id: 'again', item_id: 'a', created_at: '2026-11-05T10:00:00Z' }],
    });
    expect(a.lessonId).toBe('again');
  });

  it('schedules reviews from the first open, and not for recipes', () => {
    const [a, r] = feedItems({
      ...empty,
      items: [item('a', { created_at: '2026-11-02T10:00:00Z' }), item('r', { kind: 'recipe' })],
      events: [ev('opened', '2026-11-04T10:00:00Z', 'a'), ev('opened', '2026-11-03T10:00:00Z', 'a'), ev('opened', '2026-11-03T10:00:00Z', 'r')],
      reviews: [],
    });
    expect(a).toMatchObject({ reviewDueAt: '2026-11-06T10:00:00.000Z', reviewFormat: 'recall' });
    expect(r).toMatchObject({ reviewDueAt: null, reviewFormat: null });
  });

  it('gives recipes ingredients but no reading time', () => {
    const [r] = feedItems({ ...empty, items: [item('r', { kind: 'recipe' })], recipes: [{ item_id: 'r', ingredientCount: 6 }] });
    expect(r).toMatchObject({ ingredientCount: 6, readMinutes: null });
  });
});

describe('pickUpNext', () => {
  const build = (items: FeedSourceItem[], extra: Partial<FeedInput> = {}) => feedItems({ ...empty, items, ...extra });

  it('prefers something that finished in the last day', () => {
    const items = build([item('old'), item('fresh', { created_at: '2026-11-11T08:00:00Z' })]);
    expect(pickUpNext(items, NOW)).toMatchObject({ item: { id: 'fresh' }, reason: 'fresh' });
  });

  it('then a read save whose what-if is written but not opened', () => {
    // Opened yesterday, so its first review card isn't due yet.
    const items = build([item('unread'), item('w', { created_at: '2026-11-02T10:00:00Z' })], {
      events: [ev('opened', '2026-11-10T10:00:00Z', 'w')],
      whatifs: [wi('w')],
    });
    expect(pickUpNext(items, NOW)).toMatchObject({ item: { id: 'w' }, reason: 'whatif' });
    const opened = build([item('w')], { events: [ev('opened', '2026-11-10T10:00:00Z', 'w')], whatifs: [wi('w', { opened_at: '2026-11-10T10:05:00Z' })] });
    expect(pickUpNext(opened, NOW)).toBeNull();
  });

  it('puts a due review card before a waiting what-if', () => {
    const items = build([item('w', { created_at: '2026-11-01T10:00:00Z' })], {
      events: [ev('opened', '2026-11-02T10:00:00Z', 'w')],
      whatifs: [wi('w')],
    });
    expect(pickUpNext(items, NOW)).toMatchObject({ reason: 'review' });
  });

  it('then the oldest unopened save', () => {
    const items = build([item('newer', { created_at: '2026-11-05T10:00:00Z' }), item('oldest', { created_at: '2026-10-20T10:00:00Z' })]);
    expect(pickUpNext(items, NOW)).toMatchObject({ item: { id: 'oldest' }, reason: 'unread' });
  });

  it('skips snoozed and unfinished saves', () => {
    const items = build([
      item('snoozed', { created_at: '2026-11-11T08:00:00Z', snoozed_until: '2026-11-13T00:00:00Z' }),
      item('working', { created_at: '2026-11-11T09:00:00Z', status: 'processing' }),
      item('expired', { created_at: '2026-10-01T10:00:00Z', snoozed_until: '2026-11-10T00:00:00Z' }),
    ]);
    expect(pickUpNext(items, NOW)).toMatchObject({ item: { id: 'expired' } });
  });

  it('then a review card that has come due, longest-waiting first', () => {
    const items = build([item('a'), item('b', { created_at: '2026-10-30T10:00:00Z' })], {
      events: [ev('opened', '2026-11-05T10:00:00Z', 'a'), ev('opened', '2026-11-02T10:00:00Z', 'b')],
    });
    expect(pickUpNext(items, NOW)).toMatchObject({ item: { id: 'b' }, reason: 'review' });
  });

  it('returns null when everything is done with', () => {
    // Opened yesterday: its first review isn't due for 3 days.
    const items = build([item('a')], { events: [ev('opened', '2026-11-10T10:00:00Z', 'a')] });
    expect(pickUpNext(items, NOW)).toBeNull();
  });
});

describe('streak', () => {
  it('counts consecutive days including today', () => {
    expect(streak(['2026-11-09', '2026-11-10', '2026-11-11'], NOW)).toEqual({
      days: 3,
      freezeLeft: 1,
      activeToday: true,
      atRisk: false,
      milestone: 3,
    });
  });

  it("doesn't break before today has any activity", () => {
    expect(streak(['2026-11-09', '2026-11-10'], NOW)).toMatchObject({ days: 2, activeToday: false, atRisk: false });
  });

  it('covers one missed day a week, and a freeze from last week leaves this week’s', () => {
    // Sun 8 Nov missed (week of 2 Nov) is frozen.
    expect(streak(['2026-11-07', '2026-11-09', '2026-11-10', '2026-11-11'], NOW)).toMatchObject({ days: 4, freezeLeft: 1 });
  });

  it('is at risk in the evening once this week’s freeze is spent', () => {
    const evening = new Date('2026-11-11T17:00:00Z'); // 19:00 SAST
    expect(streak(['2026-11-08', '2026-11-10'], evening)).toMatchObject({ days: 2, freezeLeft: 0, atRisk: true });
    expect(streak(['2026-11-08', '2026-11-10'], NOW)).toMatchObject({ atRisk: false }); // midday
  });

  it('ends at a second miss in the same week', () => {
    // 9 Nov frozen (this week); 8 Nov frozen (last week); 6 Nov is last week's second miss.
    expect(streak(['2026-11-04', '2026-11-07', '2026-11-10', '2026-11-11'], NOW)).toMatchObject({ days: 3, freezeLeft: 0 });
  });

  it('is empty with no activity', () => {
    expect(streak([], NOW)).toEqual({ days: 0, freezeLeft: 1, activeToday: false, atRisk: false, milestone: null });
  });
});

describe('whatIf state', () => {
  it("follows the save's main what-if only", () => {
    const items = feedItems({
      ...empty,
      items: [item('a'), item('b'), item('c'), item('d'), item('e', { status: 'processing' })],
      whatifs: [
        wi('a', { status: 'pending' }),
        wi('b'),
        wi('c', { opened_at: '2026-11-05T10:00:00Z' }),
        wi('d', { kind: 'custom' }),
        wi('e'),
      ],
    });
    expect(Object.fromEntries(items.map((i) => [i.id, i.whatIf]))).toEqual({ a: 'thinking', b: 'ready', c: 'opened', d: null, e: null });
  });

  it('counts an opened what-if as activity for the streak and the week', () => {
    const opened = [wi('a', { kind: 'custom', opened_at: '2026-11-10T08:00:00Z' })];
    expect(activityDays([], [], 'Africa/Johannesburg', opened)).toEqual(['2026-11-10']);
    expect(weekProgress([], NOW, 'Africa/Johannesburg', [...opened, wi('b', { opened_at: '2026-11-02T08:00:00Z' })]).whatIfsOpened).toBe(1);
  });
});

describe('weekProgress', () => {
  it('counts save days this week only', () => {
    const week = weekProgress(
      [
        ev('saved', '2026-11-09T08:00:00Z'),
        ev('saved', '2026-11-11T06:00:00Z'),
        ev('saved', '2026-11-11T07:00:00Z'),
        ev('played', '2026-11-10T18:00:00Z'),
        ev('saved', '2026-11-08T08:00:00Z'), // last Sunday
        ev('opened', '2026-11-10T08:00:00Z'),
      ],
      NOW,
    );
    expect(week).toEqual({ saveDays: 2, whatIfsOpened: 0, savedOn: [true, false, true, false, false, false, false] });
  });
});

describe('buildFeed', () => {
  const input: FeedInput = {
    ...empty,
    items: [
      item('a', { created_at: '2026-11-05T10:00:00Z' }),
      item('b', { created_at: '2026-11-04T10:00:00Z', kind: 'recipe' }),
      item('c', { created_at: '2026-11-03T10:00:00Z' }),
    ],
    events: [ev('opened', '2026-11-05T11:00:00Z', 'a'), ev('saved', '2026-11-10T10:00:00Z', 'a')],
    whatifs: [wi('a'), wi('c', { status: 'pending' })],
    itemTopics: [{ item_id: 'c', topic_id: 't' }],
    topics: [{ id: 't', name: 'AI', weight: 1 }],
  };

  it('filters, pages and counts', () => {
    expect(buildFeed(input, { filter: 'whatif' }, NOW).items.map((i) => i.id)).toEqual(['a']);
    expect(buildFeed(input, { filter: 'recipe' }, NOW).items.map((i) => i.id)).toEqual(['b']);
    expect(buildFeed(input, { filter: 'unread' }, NOW).items.map((i) => i.id)).toEqual(['b', 'c']);
    expect(buildFeed(input, { topicId: 't' }, NOW).items.map((i) => i.id)).toEqual(['c']);

    const page = buildFeed(input, { limit: 2 }, NOW);
    expect(page.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(page.hasMore).toBe(true);
    const next = buildFeed(input, { limit: 2, before: page.items[1].created_at }, NOW);
    expect(next.items.map((i) => i.id)).toEqual(['c']);
    expect(next.hasMore).toBe(false);

    expect(page.counts).toEqual({ unread: 2, whatif: 1 });
    // Opened 6 days ago: its first review card (3 days) is due, and that comes before the what-if.
    expect(page.upNext).toMatchObject({ item: { id: 'a' }, reason: 'review' });
    expect(page.week.saveDays).toBe(1);
  });
});
