import { describe, expect, it } from 'vitest';
import type { FeedItem, Streak, WeekProgress } from '@/lib/items/feed';
import {
  backedOff,
  formatSlot,
  lessonCandidate,
  normalizeReminderTimes,
  pickReminder,
  REMINDER_SLOTS,
  reminderMessage,
  slotAt,
  type NudgeHistory,
} from './reminders';

// Wednesday 11 Nov 2026. 16:00Z = 18:00 SAST.
const WED_18 = new Date('2026-11-11T16:00:00Z');
const THU_18 = new Date('2026-11-12T16:00:00Z');

function item(id: string, over: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    url: 'https://youtube.com/shorts/x',
    source: 'youtube',
    kind: 'tech',
    title: `Item ${id}`,
    status: 'done',
    error: null,
    summary: null,
    thumbnail_url: null,
    duration_seconds: null,
    snoozed_until: null,
    related: null,
    created_at: '2026-11-08T10:00:00Z',
    state: 'lesson_ready',
    thumbnailShape: 'portrait',
    opened: true,
    openedAt: '2026-11-11T08:00:00Z', // 8h before WED_18
    lessonId: `lesson-${id}`,
    bestScore: null,
    topTopic: null,
    readMinutes: 1,
    ingredientCount: null,
    ...over,
  };
}

const streakOk: Streak = { days: 4, freezeLeft: 1, activeToday: true, atRisk: false, milestone: 3 };
const week: WeekProgress = { saveDays: 2, lessonsPlayed: 0, savedOn: [true, true, false, false, false, false, false] };
const feed = (items: FeedItem[], over: { streak?: Streak; week?: WeekProgress; lessons?: number } = {}) => ({
  items,
  streak: over.streak ?? streakOk,
  week: over.week ?? week,
  counts: { unread: 0, lesson: over.lessons ?? items.filter((i) => i.lessonId).length },
});
const sent = (kind: NudgeHistory['kind'], sent_at: string, tapped = false, item_id: string | null = null): NudgeHistory => ({
  kind,
  item_id,
  sent_at,
  tapped_at: tapped ? sent_at : null,
});

describe('slots', () => {
  it('lists every half hour from 07:00 to 21:30', () => {
    expect(REMINDER_SLOTS[0]).toBe(420);
    expect(REMINDER_SLOTS.at(-1)).toBe(1290);
    expect(REMINDER_SLOTS).toHaveLength(30);
  });

  it('finds the SAST slot, weekday and key', () => {
    expect(slotAt(new Date('2026-11-11T16:00:12Z'))).toEqual({ minutes: 1080, weekday: 2, key: '2026-11-11T18:00' });
    expect(slotAt(new Date('2026-11-11T05:44:00Z'))).toEqual({ minutes: 450, weekday: 2, key: '2026-11-11T07:30' });
    expect(formatSlot(450)).toBe('07:30');
  });

  it('cleans settings: allowed, unique, sorted, at most two', () => {
    expect(normalizeReminderTimes([1080, 600, 1080])).toEqual([600, 1080]);
    expect(normalizeReminderTimes([1095, 60, 1080])).toEqual([1080]);
    expect(normalizeReminderTimes([1200, 600, 900])).toEqual([600, 900]);
  });
});

describe('backedOff', () => {
  it('pauses for two days after three untapped reminders', () => {
    const h = [sent('lesson', '2026-11-09T16:00:00Z'), sent('lesson', '2026-11-10T16:00:00Z'), sent('streak', '2026-11-11T08:00:00Z')];
    expect(backedOff(h, WED_18)).toBe(true);
    expect(backedOff(h, new Date('2026-11-13T09:00:00Z'))).toBe(false);
  });

  it('ignores ready pushes and resets on any tap', () => {
    const h = [
      sent('lesson', '2026-11-09T16:00:00Z'),
      sent('lesson', '2026-11-10T16:00:00Z', true),
      sent('streak', '2026-11-11T08:00:00Z'),
      sent('ready', '2026-11-11T09:00:00Z'),
    ];
    expect(backedOff(h, WED_18)).toBe(false);
  });
});

describe('lessonCandidate', () => {
  it('waits 18h after opening and gives up after a week', () => {
    expect(lessonCandidate([item('a')], [], WED_18)).toBeNull(); // opened 8h ago
    expect(lessonCandidate([item('a')], [], THU_18)?.id).toBe('a'); // 32h
    expect(lessonCandidate([item('a', { openedAt: '2026-11-01T08:00:00Z' })], [], THU_18)).toBeNull();
  });

  it('never nudges the same save twice and prefers the most recently opened', () => {
    const items = [item('old', { openedAt: '2026-11-09T08:00:00Z' }), item('new', { openedAt: '2026-11-10T08:00:00Z' })];
    expect(lessonCandidate(items, [], THU_18)?.id).toBe('new');
    expect(lessonCandidate(items, [sent('lesson', '2026-11-11T16:00:00Z', false, 'new')], THU_18)?.id).toBe('old');
  });

  it('skips played or recipe-like saves', () => {
    expect(lessonCandidate([item('a', { state: 'played' })], [], THU_18)).toBeNull();
    expect(lessonCandidate([item('a', { lessonId: null, state: 'read' })], [], THU_18)).toBeNull();
  });
});

describe('pickReminder', () => {
  const base = { history: [] as NudgeHistory[], times: [1080] };

  it('only fires in a chosen slot', () => {
    expect(pickReminder({ ...base, feed: feed([item('a')]), now: THU_18 })).toMatchObject({ kind: 'lesson', itemId: 'a' });
    expect(pickReminder({ ...base, times: [600], feed: feed([item('a')]), now: THU_18 })).toBeNull();
    expect(pickReminder({ ...base, times: [], feed: feed([item('a')]), now: THU_18 })).toBeNull();
  });

  it('puts a breaking streak first in the last slot', () => {
    const atRisk: Streak = { days: 6, freezeLeft: 0, activeToday: false, atRisk: true, milestone: 3 };
    expect(pickReminder({ ...base, feed: feed([item('a')], { streak: atRisk }), now: THU_18 })).toEqual({ kind: 'streak', days: 6 });
    // Not in an earlier slot of the day.
    expect(pickReminder({ ...base, times: [1080, 1200], feed: feed([item('a')], { streak: atRisk }), now: THU_18 })).toMatchObject({
      kind: 'lesson',
    });
  });

  it("doesn't nudge about a 1-day streak", () => {
    const oneDay: Streak = { days: 1, freezeLeft: 0, activeToday: false, atRisk: true, milestone: null };
    expect(pickReminder({ ...base, feed: feed([], { streak: oneDay, lessons: 0 }), now: THU_18 })).toBeNull();
  });

  it('sends the mid-week check-in on Wednesday when there is something to say', () => {
    expect(pickReminder({ ...base, feed: feed([item('a')]), now: WED_18 })).toEqual({ kind: 'midweek', lessonsWaiting: 1, saveDays: 2 });
    expect(pickReminder({ ...base, feed: feed([], { lessons: 0 }), now: WED_18 })).toBeNull();
  });

  it('stays quiet while backed off', () => {
    const h = [sent('lesson', '2026-11-11T05:00:00Z'), sent('lesson', '2026-11-11T06:00:00Z'), sent('lesson', '2026-11-12T06:00:00Z')];
    expect(pickReminder({ ...base, history: h, feed: feed([item('a')]), now: THU_18 })).toBeNull();
  });
});

describe('reminderMessage', () => {
  it('pitches a lesson by its format, with Play and Read buttons', () => {
    const m = reminderMessage({ kind: 'lesson', itemId: 'i1', lessonId: 'l1', title: 'How vector databases work' }, 'n1', 'order');
    expect(m.title).toBe('2 minutes on “How vector databases work”?');
    expect(m.body).toBe('Put the steps back in order — 2 minutes.');
    expect(m.url).toBe('/play/l1?n=n1&a=open');
    expect(m.actions?.map((a) => a.url)).toEqual(['/play/l1?n=n1&a=play', '/items/i1?n=n1&a=read']);
  });

  it('words the streak and mid-week reminders', () => {
    expect(reminderMessage({ kind: 'streak', days: 6 }, 'n1').title).toBe('🔥 Keep your 6-day streak');
    expect(reminderMessage({ kind: 'midweek', lessonsWaiting: 3, saveDays: 1 }, 'n1').body).toBe(
      '1 save day so far, 3 lessons waiting — about 6 minutes.',
    );
    expect(reminderMessage({ kind: 'midweek', lessonsWaiting: 11, saveDays: 1 }, 'n1').body).toBe(
      '1 save day so far, 11 lessons waiting — start with one, it takes 2 minutes.',
    );
    expect(reminderMessage({ kind: 'midweek', lessonsWaiting: 0, saveDays: 0 }, 'n1').body).toBe(
      'Nothing saved yet this week — share one video today?',
    );
  });
});
