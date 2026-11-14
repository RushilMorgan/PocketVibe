import { describe, expect, it } from 'vitest';
import { buildStats, type StatsInput } from './stats';

// Wednesday 11 Nov 2026, 12:00 SAST. Its week starts Monday 9 Nov.
const NOW = new Date('2026-11-11T10:00:00Z');

const item = (id: string, kind: StatsInput['items'][number]['kind'], created_at: string, over: Partial<StatsInput['items'][number]> = {}) => ({
  id,
  kind,
  status: 'done' as const,
  created_at,
  cook_list_at: null,
  ...over,
});
const ev = (type: StatsInput['events'][number]['type'], created_at: string, item_id: string | null = null) => ({ type, created_at, item_id });

const input: StatsInput = {
  items: [
    item('t1', 'tech', '2026-11-10T08:00:00Z'),
    item('t2', 'tech', '2026-11-01T08:00:00Z'),
    item('n1', 'news', '2026-10-01T08:00:00Z'),
    item('r1', 'recipe', '2026-11-02T08:00:00Z', { cook_list_at: '2026-11-03T08:00:00Z' }),
    item('r2', 'recipe', '2026-11-03T08:00:00Z'),
    item('bad', null, '2026-11-09T08:00:00Z', { status: 'failed' }),
  ],
  events: [
    ev('opened', '2026-11-10T09:00:00Z', 't1'),
    ev('opened', '2026-11-10T10:00:00Z', 't1'), // twice, same day
    ev('opened', '2026-11-01T09:00:00Z', 't2'),
    ev('opened', '2026-11-05T09:00:00Z', 't2'), // came back 4 days later
    ev('opened', '2026-11-02T09:00:00Z', 'r1'),
    ev('whatif_open', '2026-11-10T09:05:00Z', 't1'),
    ev('whatif_open', '2026-11-10T09:06:00Z', 'n1'), // n1 has no card written
    ev('played', '2026-11-04T09:00:00Z', 't2'),
    ev('digest_open', '2026-11-08T17:00:00Z'),
  ],
  whatIfs: [{ item_id: 't1' }, { item_id: 't2' }],
  reviews: [{ item_id: 't2', created_at: '2026-11-06T09:00:00Z' }],
  cooks: [
    { item_id: 'r2', created_at: '2026-11-04T18:00:00Z' },
    { item_id: 'r2', created_at: '2026-11-09T18:00:00Z' },
  ],
};

describe('buildStats', () => {
  const s = buildStats(input, NOW);

  it('counts saves, including failed ones, and recent ones', () => {
    expect(s.saves).toEqual({ total: 6, last7: 2, last30: 5, failed: 1 });
  });

  it('separates opened, opened twice and came back later', () => {
    expect(s.opens).toEqual({ opened: 3, neverOpened: 2, moreThanOnce: 2, cameBack: 1 });
  });

  it('breaks finished saves down by kind', () => {
    expect(s.byKind).toEqual([
      { kind: 'tech', saves: 2, opened: 2, cameBack: 1 },
      { kind: 'news', saves: 1, opened: 0, cameBack: 0 },
      { kind: 'recipe', saves: 2, opened: 1, cameBack: 0 },
      { kind: 'other', saves: 0, opened: 0, cameBack: 0 },
    ]);
  });

  it('counts what-ifs opened only where a card exists', () => {
    expect(s.whatIfs).toEqual({ written: 2, opened: 1 });
  });

  it('counts recipes on the list, cooked, and times cooked', () => {
    expect(s.recipes).toEqual({ saved: 2, wantToCook: 1, cooked: 1, timesCooked: 2 });
  });

  it('counts reviews, lessons and digest taps', () => {
    expect(s).toMatchObject({ reviewsDone: 1, lessonsPlayed: 1, digestTaps: 1 });
  });

  it('gives the last 8 local weeks, oldest first', () => {
    expect(s.weeks).toHaveLength(8);
    expect(s.weeks.at(-1)).toEqual({ start: '2026-11-09', saves: 2, opens: 2 });
    expect(s.weeks.at(-2)).toEqual({ start: '2026-11-02', saves: 2, opens: 2 });
    expect(s.weeks[0].start).toBe('2026-09-21');
    // 1 Nov is a Sunday: it belongs to the week of 26 Oct.
    expect(s.weeks.at(-3)).toEqual({ start: '2026-10-26', saves: 1, opens: 1 });
  });

  it('handles an empty account', () => {
    const empty = buildStats({ items: [], events: [], whatIfs: [], reviews: [], cooks: [] }, NOW);
    expect(empty.saves.total).toBe(0);
    expect(empty.opens).toEqual({ opened: 0, neverOpened: 0, moreThanOnce: 0, cameBack: 0 });
  });
});
