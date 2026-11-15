/**
 * Reminders (docs/saves-redesign.md B0, B2, B5 and the streak nudge; the
 * what-if slot from docs/what-if.md Part C). Pure:
 * which reminder, if any, goes out in a slot, and its wording. The cron in
 * lib/jobs/reminders.ts loads the data and sends it via lib/nudges/send.ts.
 */
import type { Feed, FeedItem } from '@/lib/items/feed';
import type { PushMessage } from '@/lib/notify';
import type { NudgeKind } from '@/lib/supabase/database.types';
import { DEFAULT_TZ, localParts } from '@/lib/time';
import { clip, trackedUrl } from './ready';

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

/** Allowed slots: every half hour from 07:00 to 21:30 in the user's time zone, in minutes after midnight. */
export const REMINDER_SLOTS: readonly number[] = Array.from({ length: 30 }, (_, i) => 420 + i * 30);
export const DEFAULT_REMINDER_TIMES = [1080];
export const MAX_REMINDERS_A_DAY = 2;

/** A what-if nudge waits this long after the save, and gives up after WHATIF_MAX_AGE. */
const WHATIF_MIN_AGE = 18 * HOUR_MS;
const WHATIF_MAX_AGE = 7 * DAY_MS;
/** After this many untapped reminders in a row, pause… */
const BACKOFF_AFTER = 3;
/** …for this long after the last one. */
const BACKOFF_FOR = 2 * DAY_MS;
/** The cook nudge goes out on this local weekday (Mon = 0): Saturday… */
const COOK_WEEKDAY = 5;
/** …and not again within this long. */
const COOK_EVERY = 6 * DAY_MS;
/** "Keep your 1-day streak" isn't worth a notification. */
const STREAK_NUDGE_MIN = 2;

/** 1080 → "18:00". */
export function formatSlot(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * The half-hour slot `now` falls in, in the user's time zone: minutes after
 * local midnight, Mon=0 weekday, and a key (local date + time) unique per user.
 * Zones offset by :45 (e.g. Nepal) land in the slot that started 15 minutes earlier.
 */
export function slotAt(now: Date, tz: string = DEFAULT_TZ): { minutes: number; weekday: number; key: string } {
  const local = localParts(now, tz);
  const minutes = local.hour * 60 + (local.minute < 30 ? 0 : 30);
  return { minutes, weekday: local.weekday, key: `${local.date}T${formatSlot(minutes)}` };
}

/** Cleans a Settings choice: allowed slots only, no duplicates, sorted, at most two. */
export function normalizeReminderTimes(times: number[]): number[] {
  return [...new Set(times.filter((t) => REMINDER_SLOTS.includes(t)))].sort((a, b) => a - b).slice(0, MAX_REMINDERS_A_DAY);
}

export interface NudgeHistory {
  kind: NudgeKind;
  item_id: string | null;
  sent_at: string;
  tapped_at: string | null;
}

export type ReminderChoice =
  | { kind: 'streak'; days: number }
  | { kind: 'midweek'; whatIfsWaiting: number; saveDays: number }
  | { kind: 'whatif'; itemId: string; title: string | null; scenario: string }
  | { kind: 'cook'; itemId: string; title: string | null; daysOnList: number }
  | { kind: 'review'; itemId: string; title: string | null; format: 'recall' | 'connect'; relatedTitle: string | null };

/** Three untapped reminders in a row → quiet for two days after the last one. */
export function backedOff(history: NudgeHistory[], now: Date): boolean {
  const recent = history
    .filter((h) => h.kind !== 'ready')
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
    .slice(0, BACKOFF_AFTER);
  if (recent.length < BACKOFF_AFTER || recent.some((h) => h.tapped_at)) return false;
  return now.getTime() - Date.parse(recent[0].sent_at) < BACKOFF_FOR;
}

/** Saved 18h–7d ago, with a what-if that's never been opened and never nudged about. Newest first. */
export function whatIfCandidate(items: FeedItem[], history: NudgeHistory[], now: Date): FeedItem | null {
  const nudged = new Set(history.filter((h) => h.kind === 'whatif').map((h) => h.item_id));
  const t = now.getTime();
  return (
    items
      .filter((i) => i.whatIf && !i.whatIfOpened && !nudged.has(i.id))
      .filter((i) => {
        const age = t - Date.parse(i.created_at);
        return age >= WHATIF_MIN_AGE && age <= WHATIF_MAX_AGE;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/** A recipe on the Want to cook list (lib/recipes). */
export interface CookListEntry {
  itemId: string;
  title: string | null;
  addedAt: string;
}

/**
 * Saturday's "cook one this weekend?": the recipe that's waited longest on the
 * Want to cook list, preferring ones not nudged about before. At most one
 * cook nudge every 6 days.
 */
export function cookCandidate(list: CookListEntry[], history: NudgeHistory[], now: Date, tz: string = DEFAULT_TZ): CookListEntry | null {
  if (slotAt(now, tz).weekday !== COOK_WEEKDAY || !list.length) return null;
  const sent = history.filter((h) => h.kind === 'cook');
  if (sent.some((h) => now.getTime() - Date.parse(h.sent_at) < COOK_EVERY)) return null;
  const nudged = new Set(sent.map((h) => h.item_id));
  const oldestFirst = [...list].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  return oldestFirst.find((e) => !nudged.has(e.itemId)) ?? oldestFirst[0];
}

/**
 * A save whose review card is due and hasn't been nudged about since it fell
 * due. Longest-waiting first.
 */
export function reviewCandidate(items: FeedItem[], history: NudgeHistory[], now: Date): FeedItem | null {
  const nowIso = now.toISOString();
  return (
    items
      .filter((i) => i.reviewDueAt && i.reviewDueAt <= nowIso)
      .filter((i) => !history.some((h) => h.kind === 'review' && h.item_id === i.id && h.sent_at >= i.reviewDueAt!))
      .sort((a, b) => a.reviewDueAt!.localeCompare(b.reviewDueAt!))[0] ?? null
  );
}

/**
 * The reminder for this slot, or null. Only in one of your chosen slots, not
 * while backed off. In your last slot of the day: a streak about to break
 * wins, then (Wednesdays) the mid-week check-in; otherwise (Saturdays) a
 * recipe from the Want to cook list, then an unopened what-if, then a review
 * card that's due.
 */
export function pickReminder(input: {
  feed: Pick<Feed, 'items' | 'streak' | 'week' | 'counts'>;
  history: NudgeHistory[];
  times: number[];
  now: Date;
  /** The user's time zone; slots and "Wednesday" are local. */
  tz?: string;
  /** Recipes on the Want to cook list, for Saturday's cook nudge. */
  cookList?: CookListEntry[];
}): ReminderChoice | null {
  const { feed, history, times, now, tz = DEFAULT_TZ, cookList = [] } = input;
  const slot = slotAt(now, tz);
  if (!times.includes(slot.minutes) || backedOff(history, now)) return null;
  const lastSlot = slot.minutes === Math.max(...times);

  const { streak, week, counts } = feed;
  if (lastSlot && streak.days >= STREAK_NUDGE_MIN && !streak.activeToday && streak.freezeLeft === 0) {
    return { kind: 'streak', days: streak.days };
  }
  if (lastSlot && slot.weekday === 2 && (counts.whatif > 0 || week.saveDays === 0)) {
    return { kind: 'midweek', whatIfsWaiting: counts.whatif, saveDays: week.saveDays };
  }
  const cook = cookCandidate(cookList, history, now, tz);
  if (cook) {
    const daysOnList = Math.max(0, Math.floor((now.getTime() - Date.parse(cook.addedAt)) / DAY_MS));
    return { kind: 'cook', itemId: cook.itemId, title: cook.title, daysOnList };
  }
  const item = whatIfCandidate(feed.items, history, now);
  if (item?.whatIf) return { kind: 'whatif', itemId: item.id, title: item.title, scenario: item.whatIf };
  const due = reviewCandidate(feed.items, history, now);
  if (due) {
    return {
      kind: 'review',
      itemId: due.id,
      title: due.title,
      format: due.reviewFormat === 'connect' && due.related ? 'connect' : 'recall',
      relatedTitle: due.related?.title ?? null,
    };
  }
  return null;
}

export function reminderMessage(choice: ReminderChoice, nudgeId: string): PushMessage {
  switch (choice.kind) {
    case 'whatif': {
      const item = `/items/${choice.itemId}`;
      const card = `${item}?whatif=1`;
      return {
        title: `💭 ${clip(choice.scenario, 70)}`,
        body: choice.title ? `From “${clip(choice.title, 50)}”: who wins, who loses, and 3 signs to watch.` : 'Who wins, who loses, and 3 signs to watch.',
        url: trackedUrl(card, nudgeId, 'open'),
        actions: [
          { action: 'whatif', title: '💭 What if', url: trackedUrl(card, nudgeId, 'whatif') },
          { action: 'read', title: 'Read it first', url: trackedUrl(item, nudgeId, 'read') },
        ],
      };
    }
    case 'cook': {
      const recipe = `/items/${choice.itemId}`;
      const cookIt = `/cook/${choice.itemId}`;
      const waited = choice.daysOnList >= 2 ? `It's been on your Want to cook list for ${choice.daysOnList} days.` : "It's on your Want to cook list.";
      return {
        title: choice.title ? `🍳 Cook “${clip(choice.title, 45)}” this weekend?` : '🍳 Cook something this weekend?',
        body: `${waited} Step by step, with timers.`,
        url: trackedUrl(recipe, nudgeId, 'open'),
        actions: [
          { action: 'play', title: '👩‍🍳 Start cooking', url: trackedUrl(cookIt, nudgeId, 'play') },
          { action: 'read', title: 'See the recipe', url: trackedUrl(recipe, nudgeId, 'read') },
        ],
      };
    }
    case 'review': {
      const review = `/review/${choice.itemId}`;
      const title = clip(choice.title ?? 'something you saved', 40);
      return {
        title:
          choice.format === 'connect' && choice.relatedTitle
            ? `How does “${title}” connect to “${clip(choice.relatedTitle, 30)}”?`
            : `Still remember “${title}”?`,
        body: choice.format === 'connect' ? 'Then and now — one card, 20 seconds.' : 'One card, 20 seconds. Flip it and see.',
        url: trackedUrl(review, nudgeId, 'open'),
        actions: [{ action: 'play', title: '🧠 Try it', url: trackedUrl(review, nudgeId, 'play') }],
      };
    }
    case 'streak':
      return {
        title: `🔥 Keep your ${choice.days}-day streak`,
        body: 'Save something or open a what-if before midnight — this week’s freeze is already used.',
        url: trackedUrl('/?filter=whatif', nudgeId, 'open'),
        actions: [{ action: 'whatif', title: '💭 Open a what-if', url: trackedUrl('/?filter=whatif', nudgeId, 'whatif') }],
      };
    case 'midweek': {
      const { whatIfsWaiting: n, saveDays } = choice;
      if (n === 0) {
        return {
          title: 'Halfway through the week',
          body: 'Nothing saved yet this week — share one video today?',
          url: trackedUrl('/', nudgeId, 'open'),
        };
      }
      const days = `${saveDays} save day${saveDays === 1 ? '' : 's'} so far`;
      // A big backlog reads like homework: ask for one.
      const ask = n > 3 ? 'start with one, it takes a minute' : 'a minute each';
      return {
        title: 'Halfway through the week',
        body: `${days}, ${n} what-if${n === 1 ? '' : 's'} unopened — ${ask}.`,
        url: trackedUrl('/?filter=whatif', nudgeId, 'open'),
        actions: [{ action: 'whatif', title: '💭 Open one', url: trackedUrl('/?filter=whatif', nudgeId, 'whatif') }],
      };
    }
  }
}
