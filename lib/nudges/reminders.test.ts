import { describe, expect, it } from 'vitest';
import type { FeedItem, Streak, WeekProgress } from '@/lib/items/feed';
import {
  backedOff,
  cookCandidate,
  formatSlot,
  normalizeReminderTimes,
  pickReminder,
  REMINDER_SLOTS,
  reviewCandidate,
  reminderMessage,
  slotAt,
  whatIfCandidate,
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
    what_if: `What if ${id}?`,
    thumbnail_url: null,
    duration_seconds: null,
    snoozed_until: null,
    related: null,
    created_at: '2026-11-11T08:00:00Z', // 8h before WED_18
    state: 'read',
    thumbnailShape: 'portrait',
    opened: true,
    openedAt: '2026-11-11T08:00:00Z',
    whatIf: `What if ${id}?`,
    whatIfOpened: false,
    bestScore: null,
    topTopic: null,
    readMinutes: 1,
    ingredientCount: null,
    reviewDueAt: null,
    reviewFormat: null,
    ...over,
  };
}

const streakOk: Streak = { days: 4, freezeLeft: 1, activeToday: true, atRisk: false, milestone: 3 };
const week: WeekProgress = { saveDays: 2, whatIfsOpened: 0, savedOn: [true, true, false, false, false, false, false] };
const feed = (items: FeedItem[], over: { streak?: Streak; week?: WeekProgress; whatIfs?: number } = {}) => ({
  items,
  streak: over.streak ?? streakOk,
  week: over.week ?? week,
  counts: { unread: 0, whatif: over.whatIfs ?? items.filter((i) => i.whatIf && !i.whatIfOpened).length },
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

  it("finds the slot in the user's time zone", () => {
    const at = new Date('2026-11-11T16:00:12Z');
    expect(slotAt(at, 'Europe/London')).toEqual({ minutes: 960, weekday: 2, key: '2026-11-11T16:00' });
    expect(slotAt(at, 'Asia/Tokyo')).toEqual({ minutes: 60, weekday: 3, key: '2026-11-12T01:00' });
    expect(slotAt(new Date('2026-11-11T12:30:00Z'), 'Asia/Kolkata')).toMatchObject({ minutes: 1080 }); // 18:00 IST
  });

  it('defaults to South African time', () => {
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

describe('whatIfCandidate', () => {
  it('waits 18h after the save and gives up after a week', () => {
    expect(whatIfCandidate([item('a')], [], WED_18)).toBeNull(); // saved 8h ago
    expect(whatIfCandidate([item('a')], [], THU_18)?.id).toBe('a'); // 32h
    expect(whatIfCandidate([item('a', { created_at: '2026-11-01T08:00:00Z' })], [], THU_18)).toBeNull();
  });

  it('never nudges the same save twice and prefers the newest save', () => {
    const items = [item('old', { created_at: '2026-11-09T08:00:00Z' }), item('new', { created_at: '2026-11-10T08:00:00Z' })];
    expect(whatIfCandidate(items, [], THU_18)?.id).toBe('new');
    expect(whatIfCandidate(items, [sent('whatif', '2026-11-11T16:00:00Z', false, 'new')], THU_18)?.id).toBe('old');
  });

  it('skips saves whose what-if was opened, or that have none', () => {
    expect(whatIfCandidate([item('a', { whatIfOpened: true })], [], THU_18)).toBeNull();
    expect(whatIfCandidate([item('a', { whatIf: null })], [], THU_18)).toBeNull();
  });
});

describe('pickReminder', () => {
  const base = { history: [] as NudgeHistory[], times: [1080] };

  it('fires at 18:00 local wherever you are', () => {
    // 18:00 in London is 18:00Z; at that moment it's 20:00 in Johannesburg.
    const london18 = new Date('2026-11-12T18:00:00Z');
    expect(pickReminder({ ...base, tz: 'Europe/London', feed: feed([item('a')]), now: london18 })).toMatchObject({ kind: 'whatif' });
    expect(pickReminder({ ...base, feed: feed([item('a')]), now: london18 })).toBeNull();
  });

  it('only fires in a chosen slot', () => {
    expect(pickReminder({ ...base, feed: feed([item('a')]), now: THU_18 })).toMatchObject({ kind: 'whatif', itemId: 'a', scenario: 'What if a?' });
    expect(pickReminder({ ...base, times: [600], feed: feed([item('a')]), now: THU_18 })).toBeNull();
    expect(pickReminder({ ...base, times: [], feed: feed([item('a')]), now: THU_18 })).toBeNull();
  });

  it('puts a breaking streak first in the last slot', () => {
    const atRisk: Streak = { days: 6, freezeLeft: 0, activeToday: false, atRisk: true, milestone: 3 };
    expect(pickReminder({ ...base, feed: feed([item('a')], { streak: atRisk }), now: THU_18 })).toEqual({ kind: 'streak', days: 6 });
    // Not in an earlier slot of the day.
    expect(pickReminder({ ...base, times: [1080, 1200], feed: feed([item('a')], { streak: atRisk }), now: THU_18 })).toMatchObject({
      kind: 'whatif',
    });
  });

  it("doesn't nudge about a 1-day streak", () => {
    const oneDay: Streak = { days: 1, freezeLeft: 0, activeToday: false, atRisk: true, milestone: null };
    expect(pickReminder({ ...base, feed: feed([], { streak: oneDay, whatIfs: 0 }), now: THU_18 })).toBeNull();
  });

  it('sends the mid-week check-in on Wednesday when there is something to say', () => {
    expect(pickReminder({ ...base, feed: feed([item('a')]), now: WED_18 })).toEqual({ kind: 'midweek', whatIfsWaiting: 1, saveDays: 2 });
    expect(pickReminder({ ...base, feed: feed([], { whatIfs: 0 }), now: WED_18 })).toBeNull();
  });

  it('stays quiet while backed off', () => {
    const h = [sent('whatif', '2026-11-11T05:00:00Z'), sent('whatif', '2026-11-11T06:00:00Z'), sent('whatif', '2026-11-12T06:00:00Z')];
    expect(pickReminder({ ...base, history: h, feed: feed([item('a')]), now: THU_18 })).toBeNull();
  });
});

describe('the weekend cook nudge', () => {
  // Saturday 14 Nov 2026, 18:00 SAST.
  const SAT_18 = new Date('2026-11-14T16:00:00Z');
  const list = [
    { itemId: 'new', title: 'Hot chicken dip', addedAt: '2026-11-12T10:00:00Z' },
    { itemId: 'old', title: 'Chicken shawarma', addedAt: '2026-11-03T10:00:00Z' },
  ];

  it('picks the recipe that has waited longest, on Saturdays only', () => {
    expect(cookCandidate(list, [], SAT_18)?.itemId).toBe('old');
    expect(cookCandidate(list, [], THU_18)).toBeNull();
    expect(cookCandidate([], [], SAT_18)).toBeNull();
    // Saturday in Johannesburg is still Friday in Honolulu.
    expect(cookCandidate(list, [], new Date('2026-11-14T06:00:00Z'), 'Pacific/Honolulu')).toBeNull();
  });

  it('goes out at most once every 6 days, and moves on to a recipe not nudged before', () => {
    expect(cookCandidate(list, [sent('cook', '2026-11-14T08:00:00Z', false, 'old')], SAT_18)).toBeNull();
    expect(cookCandidate(list, [sent('cook', '2026-11-07T16:00:00Z', false, 'old')], SAT_18)?.itemId).toBe('new');
    const both = [sent('cook', '2026-10-31T16:00:00Z', false, 'old'), sent('cook', '2026-11-07T16:00:00Z', false, 'new')];
    expect(cookCandidate(list, both, SAT_18)?.itemId).toBe('old'); // all nudged once: start again
  });

  it('comes before a what-if on Saturday, and is worded with how long it has waited', () => {
    const choice = pickReminder({ history: [], times: [1080], feed: feed([item('a', { created_at: '2026-11-12T08:00:00Z' })]), now: SAT_18, cookList: list });
    expect(choice).toEqual({ kind: 'cook', itemId: 'old', title: 'Chicken shawarma', daysOnList: 11 });
    const m = reminderMessage(choice!, 'n1');
    expect(m.title).toBe('🍳 Cook “Chicken shawarma” this weekend?');
    expect(m.body).toBe("It's been on your Want to cook list for 11 days. Step by step, with timers.");
    expect(m.url).toBe('/items/old?n=n1&a=open');
    expect(m.actions?.map((a) => a.url)).toEqual(['/cook/old?n=n1&a=play', '/items/old?n=n1&a=read']);
  });

  it('leaves Saturday to the what-if when the list is empty', () => {
    expect(pickReminder({ history: [], times: [1080], feed: feed([item('a', { created_at: '2026-11-12T08:00:00Z' })]), now: SAT_18, cookList: [] })).toMatchObject({ kind: 'whatif' });
  });
});

describe('review reminders', () => {
  const due = (id: string, reviewDueAt: string, over: Partial<FeedItem> = {}) =>
    item(id, { whatIf: null, reviewDueAt, reviewFormat: 'recall', ...over });

  it('come after unopened what-ifs, longest-waiting first', () => {
    const items = [due('late', '2026-11-11T10:00:00Z'), due('early', '2026-11-08T10:00:00Z')];
    expect(pickReminder({ history: [], times: [1080], feed: feed(items, { whatIfs: 0 }), now: THU_18 })).toMatchObject({
      kind: 'review',
      itemId: 'early',
      format: 'recall',
    });
    expect(whatIfCandidate(items, [], THU_18)).toBeNull();
    expect(reviewCandidate([...items, item('whatif')], [], THU_18)?.id).toBe('early');
    // With a what-if old enough to nudge about, that goes first.
    const withWhatIf = [...items, item('whatif', { created_at: '2026-11-10T08:00:00Z' })];
    expect(pickReminder({ history: [], times: [1080], feed: feed(withWhatIf), now: THU_18 })).toMatchObject({ kind: 'whatif', itemId: 'whatif' });
  });

  it("aren't sent twice for the same due date", () => {
    const items = [due('a', '2026-11-08T10:00:00Z')];
    expect(reviewCandidate(items, [sent('review', '2026-11-09T16:00:00Z', false, 'a')], THU_18)).toBeNull();
    // An older nudge, from before this due date, doesn't count.
    expect(reviewCandidate(items, [sent('review', '2026-11-01T16:00:00Z', false, 'a')], THU_18)?.id).toBe('a');
  });

  it('use Then and now wording when connected', () => {
    const m = reminderMessage(
      { kind: 'review', itemId: 'i1', title: 'AI SaaS cloning', format: 'connect', relatedTitle: 'Claude side hustles' },
      'n1',
    );
    expect(m.title).toBe('How does “AI SaaS cloning” connect to “Claude side hustles”?');
    expect(m.url).toBe('/review/i1?n=n1&a=open');
    expect(reminderMessage({ kind: 'review', itemId: 'i1', title: 'Naga cave', format: 'recall', relatedTitle: null }, 'n1').title).toBe(
      'Still remember “Naga cave”?',
    );
  });
});

describe('reminderMessage', () => {
  it('leads a what-if with its scenario, with What if and Read buttons', () => {
    const m = reminderMessage(
      { kind: 'whatif', itemId: 'i1', title: 'How vector databases work', scenario: 'What if every app ships with a vector database by 2028?' },
      'n1',
    );
    expect(m.title).toBe('💭 What if every app ships with a vector database by 2028?');
    expect(m.body).toBe('From “How vector databases work”: who wins, who loses, and 3 signs to watch.');
    expect(m.url).toBe('/items/i1?whatif=1&n=n1&a=open');
    expect(m.actions?.map((a) => a.url)).toEqual(['/items/i1?whatif=1&n=n1&a=whatif', '/items/i1?n=n1&a=read']);
  });

  it('words the streak and mid-week reminders', () => {
    expect(reminderMessage({ kind: 'streak', days: 6 }, 'n1').title).toBe('🔥 Keep your 6-day streak');
    expect(reminderMessage({ kind: 'streak', days: 6 }, 'n1').url).toBe('/?filter=whatif&n=n1&a=open');
    expect(reminderMessage({ kind: 'midweek', whatIfsWaiting: 3, saveDays: 1 }, 'n1').body).toBe(
      '1 save day so far, 3 what-ifs unopened — a minute each.',
    );
    expect(reminderMessage({ kind: 'midweek', whatIfsWaiting: 11, saveDays: 1 }, 'n1').body).toBe(
      '1 save day so far, 11 what-ifs unopened — start with one, it takes a minute.',
    );
    expect(reminderMessage({ kind: 'midweek', whatIfsWaiting: 0, saveDays: 0 }, 'n1').body).toBe(
      'Nothing saved yet this week — share one video today?',
    );
  });
});
