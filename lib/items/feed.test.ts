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
    what_if: null,
    thumbnail_url: null,
    duration_seconds: null,
    snoozed_until: null,
    related: null,
    created_at: '2026-11-01T10:00:00Z',
    ...over,
  };
}

const empty: FeedInput = { items: [], events: [], whatIfs: [], recipes: [], itemTopics: [], topics: [], reviews: [] };
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
    [{ status: 'processing', opened: false, reviewed: false, bestScore: null }, 'working'],
    [{ status: 'failed', opened: true, reviewed: false, bestScore: null }, 'failed'],
    [{ status: 'done', opened: false, reviewed: false, bestScore: null }, 'new'],
    [{ status: 'done', opened: true, reviewed: false, bestScore: null }, 'read'],
    [{ status: 'done', opened: true, reviewed: false, bestScore: 0.6 }, 'read'],
    [{ status: 'done', opened: true, reviewed: true, bestScore: 0.6 }, 'reviewed'],
    [{ status: 'done', opened: true, reviewed: true, bestScore: 0.8 }, 'mastered'],
  ] as const)('state %o → %s', (input, expected) => {
    expect(feedState(input)).toBe(expected);
  });
});

describe('feedItems', () => {
  it('derives what-if, score, opened and top topic', () => {
    const items = feedItems({
      ...empty,
      items: [item('a', { what_if: 'What if A?' }), item('b', { created_at: '2026-11-02T10:00:00Z', what_if: 'What if B?' })],
      events: [
        ev('opened', '2026-11-03T10:00:00Z', 'a'),
        ev('whatif_open', '2026-11-03T10:01:00Z', 'a'),
        ev('played', '2026-11-04T10:00:00Z', 'b'),
        ev('score', '2026-11-04T10:00:00Z', 'b', 0.5),
        ev('score', '2026-11-05T10:00:00Z', 'b', 0.9),
      ],
      whatIfs: [{ item_id: 'a' }],
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
    expect(a).toMatchObject({ state: 'read', whatIf: 'What if A?', whatIfOpened: true, opened: true, topTopic: 'Databases', thumbnailShape: 'portrait' });
    // b has a scenario but its card was never written, so it has no what-if to offer.
    expect(b).toMatchObject({ state: 'mastered', whatIf: null, whatIfOpened: false, bestScore: 0.9 });
  });

  it('marks a save reviewed once it has a review card rating', () => {
    const [a] = feedItems({
      ...empty,
      items: [item('a')],
      events: [ev('opened', '2026-11-02T10:00:00Z', 'a')],
      reviews: [{ item_id: 'a', rating: 'got', format: 'recall', created_at: '2026-11-05T10:00:00Z' }],
    });
    expect(a.state).toBe('reviewed');
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

  it('prefers the newest unopened save with a what-if over older unread ones', () => {
    const items = build(
      [
        item('old'),
        item('with', { created_at: '2026-11-05T10:00:00Z', what_if: 'What if?' }),
        item('newer', { created_at: '2026-11-08T10:00:00Z', what_if: 'What if too?' }),
        item('plain', { created_at: '2026-11-09T10:00:00Z' }),
      ],
      { whatIfs: [{ item_id: 'with' }, { item_id: 'newer' }] },
    );
    expect(pickUpNext(items, NOW)).toMatchObject({ item: { id: 'newer' }, reason: 'whatif' });
  });

  it('puts a review that is due ahead of a what-if', () => {
    const items = build([item('due', { created_at: '2026-10-30T10:00:00Z' }), item('with', { what_if: 'What if?' })], {
      events: [ev('opened', '2026-11-02T10:00:00Z', 'due')],
      whatIfs: [{ item_id: 'with' }],
    });
    expect(pickUpNext(items, NOW)).toMatchObject({ item: { id: 'due' }, reason: 'review' });
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

  it('picks the review card that has waited longest', () => {
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

describe('activity days', () => {
  it('counts saves, opened what-ifs, lessons and reviews', () => {
    const days = activityDays(
      [ev('saved', '2026-11-09T08:00:00Z'), ev('whatif_open', '2026-11-10T08:00:00Z', 'a'), ev('played', '2026-11-11T08:00:00Z'), ev('opened', '2026-11-07T08:00:00Z')],
      [{ item_id: 'a', rating: 'got', format: 'recall', created_at: '2026-11-08T08:00:00Z' }],
    );
    expect(days.sort()).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']);
    expect(activityDays([], [], 'Africa/Johannesburg', [{ created_at: '2026-11-06T18:00:00Z' }])).toEqual(['2026-11-06']);
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

describe('weekProgress', () => {
  it('counts save days and opened what-ifs this week only', () => {
    const week = weekProgress(
      [
        ev('saved', '2026-11-09T08:00:00Z'),
        ev('saved', '2026-11-11T06:00:00Z'),
        ev('saved', '2026-11-11T07:00:00Z'),
        ev('played', '2026-11-10T18:00:00Z'),
        ev('whatif_open', '2026-11-10T18:00:00Z', 'a'),
        ev('whatif_open', '2026-11-11T08:00:00Z', 'a'), // same save again
        ev('whatif_open', '2026-11-07T08:00:00Z', 'b'), // last week
        ev('saved', '2026-11-08T08:00:00Z'), // last Sunday
        ev('opened', '2026-11-10T08:00:00Z'),
      ],
      NOW,
    );
    expect(week).toEqual({ saveDays: 2, whatIfsOpened: 1, savedOn: [true, false, true, false, false, false, false] });
  });
});

describe('buildFeed', () => {
  const input: FeedInput = {
    ...empty,
    items: [
      item('a', { created_at: '2026-11-05T10:00:00Z', what_if: 'What if?' }),
      item('b', { created_at: '2026-11-04T10:00:00Z', kind: 'recipe' }),
      item('c', { created_at: '2026-11-03T10:00:00Z' }),
    ],
    events: [ev('opened', '2026-11-05T11:00:00Z', 'a'), ev('saved', '2026-11-10T10:00:00Z', 'a')],
    whatIfs: [{ item_id: 'a' }],
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
    // a was opened 6 days ago, so its first review card is due and comes first.
    expect(page.upNext).toMatchObject({ item: { id: 'a' }, reason: 'review' });
    expect(page.week.saveDays).toBe(1);
  });
});
