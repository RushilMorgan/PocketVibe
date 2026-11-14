/**
 * The saves feed, worked out from plain rows (docs/saves-redesign.md Part A).
 * Pure: `lib/items/feed-service.ts` loads the rows, everything here is tested.
 * Feed volume is one person's saves, so the whole list is built in memory and
 * filtered/paged after; revisit if it ever reaches thousands.
 */
import { reviewPlan, type ReviewLog } from '@/lib/reviews/schedule';
import { DEFAULT_TZ, localDate, localParts } from '@/lib/time';
import type { EventType, ItemRow, ReviewFormat } from '@/lib/supabase/database.types';

/** 'mastered' is only for saves with a lesson score from before lessons moved behind Tools (docs/what-if.md Part C). */
export type FeedState = 'working' | 'failed' | 'new' | 'read' | 'reviewed' | 'mastered';
export type FeedFilter = 'unread' | 'whatif' | 'recipe';
export type ThumbnailShape = 'portrait' | 'landscape';
export type UpNextReason = 'review' | 'whatif' | 'unread';

/** Best score at or above this counts as mastered. */
export const MASTERED = 0.8;
/** How long "Not now" hides an item from Up next. */
export const SNOOZE_DAYS = 3;
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;
/** After this local hour an inactive day with no freeze left is "at risk". */
const AT_RISK_HOUR = 18;
export const WEEK_TARGET = { saveDays: 5 } as const;

export type FeedSourceItem = Pick<
  ItemRow,
  | 'id'
  | 'url'
  | 'source'
  | 'kind'
  | 'title'
  | 'status'
  | 'error'
  | 'summary'
  | 'what_if'
  | 'thumbnail_url'
  | 'duration_seconds'
  | 'snoozed_until'
  | 'related'
  | 'created_at'
>;

export interface FeedInput {
  items: FeedSourceItem[];
  events: { item_id: string | null; type: EventType; value: number | null; created_at: string }[];
  /** Saves that have a what-if card written (item_outputs of type 'whatif'). */
  whatIfs: { item_id: string }[];
  recipes: { item_id: string; ingredientCount: number }[];
  itemTopics: { item_id: string; topic_id: string }[];
  topics: { id: string; name: string; weight: number }[];
  /** Ratings from review cards (lib/reviews). */
  reviews: (ReviewLog & { item_id: string })[];
}

export type FeedItem = FeedSourceItem & {
  state: FeedState;
  thumbnailShape: ThumbnailShape;
  opened: boolean;
  /** When it was last opened, if ever. */
  openedAt: string | null;
  /** The save's what-if scenario, once its card is written; null = none. */
  whatIf: string | null;
  /** Whether a what-if on this save has been opened. */
  whatIfOpened: boolean;
  bestScore: number | null;
  topTopic: string | null;
  /** Rough reading time of the explainer; null for recipes and unfinished items. */
  readMinutes: number | null;
  ingredientCount: number | null;
  /** When its next review card is due (lib/reviews/schedule.ts); null = not eligible or done. */
  reviewDueAt: string | null;
  reviewFormat: ReviewFormat | null;
};

export interface Streak {
  days: number;
  /** 1 if this week's freeze is unused. */
  freezeLeft: 0 | 1;
  activeToday: boolean;
  atRisk: boolean;
  /** Highest milestone reached (3, 7, 14, 30, 60, 100), or null. */
  milestone: number | null;
}

export interface WeekProgress {
  saveDays: number;
  /** Saves whose what-if was opened this week. */
  whatIfsOpened: number;
  /** One flag per day Mon–Sun: was something saved that day. */
  savedOn: boolean[];
}

export interface FeedOptions {
  filter?: FeedFilter;
  topicId?: string;
  /** created_at cursor: only items older than this. */
  before?: string;
  limit?: number;
}

export interface Feed {
  items: FeedItem[];
  hasMore: boolean;
  upNext: { item: FeedItem; reason: UpNextReason } | null;
  /** `whatif` = what-ifs written but not opened yet. */
  counts: { unread: number; whatif: number };
  streak: Streak;
  week: WeekProgress;
}

// ── dates (in the user's own time zone, lib/time.ts) ────────────────────────

const DAY_MS = 24 * 3600_000;

function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
  return addDays(date, -dow);
}

// ── per item ─────────────────────────────────────────────────────────────────

export function thumbnailShape(item: Pick<ItemRow, 'url' | 'source'>): ThumbnailShape {
  if (item.source === 'tiktok') return 'portrait';
  try {
    return new URL(item.url).pathname.startsWith('/shorts/') ? 'portrait' : 'landscape';
  } catch {
    return 'landscape';
  }
}

/** About 200 words a minute, at least 1. */
export function readMinutes(summary: string | null): number | null {
  if (!summary?.trim()) return null;
  return Math.max(1, Math.round(summary.trim().split(/\s+/).length / 200));
}

export function feedState(s: {
  status: ItemRow['status'];
  opened: boolean;
  /** Has at least one review card rating. */
  reviewed: boolean;
  bestScore: number | null;
}): FeedState {
  if (s.status === 'queued' || s.status === 'processing') return 'working';
  if (s.status === 'failed') return 'failed';
  if ((s.bestScore ?? 0) >= MASTERED) return 'mastered';
  if (s.reviewed) return 'reviewed';
  return s.opened ? 'read' : 'new';
}

/** Turns rows into feed items, newest first. */
export function feedItems(input: FeedInput): FeedItem[] {
  const opened = new Map<string, string>();
  const firstOpened = new Map<string, string>();
  const whatIfOpened = new Set<string>();
  const best = new Map<string, number>();
  for (const e of input.events) {
    if (!e.item_id) continue;
    if (e.type === 'opened' && (opened.get(e.item_id) ?? '') < e.created_at) opened.set(e.item_id, e.created_at);
    if (e.type === 'opened' && (firstOpened.get(e.item_id) ?? '￿') > e.created_at) firstOpened.set(e.item_id, e.created_at);
    if (e.type === 'whatif_open') whatIfOpened.add(e.item_id);
    if (e.type === 'score' && e.value !== null) best.set(e.item_id, Math.max(best.get(e.item_id) ?? 0, e.value));
  }

  const hasWhatIf = new Set((input.whatIfs ?? []).map((w) => w.item_id));

  const topicById = new Map(input.topics.map((t) => [t.id, t]));
  const topTopic = new Map<string, { name: string; weight: number }>();
  for (const link of input.itemTopics) {
    const t = topicById.get(link.topic_id);
    const current = topTopic.get(link.item_id);
    if (t && (!current || t.weight > current.weight)) topTopic.set(link.item_id, t);
  }
  const ingredients = new Map(input.recipes.map((r) => [r.item_id, r.ingredientCount]));
  const reviewsFor = new Map<string, ReviewLog[]>();
  for (const r of input.reviews ?? []) reviewsFor.set(r.item_id, [...(reviewsFor.get(r.item_id) ?? []), r]);

  return [...input.items]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((item) => {
      const reviews = reviewsFor.get(item.id) ?? [];
      const bestScore = best.get(item.id) ?? null;
      const isOpened = opened.has(item.id);
      const done = item.status === 'done';
      const review = done
        ? reviewPlan({
            firstOpenedAt: firstOpened.get(item.id) ?? null,
            reviews,
            hasRelated: Boolean(item.related),
            isRecipe: item.kind === 'recipe',
          })
        : null;
      return {
        ...item,
        state: feedState({ status: item.status, opened: isOpened, reviewed: reviews.length > 0, bestScore }),
        thumbnailShape: thumbnailShape(item),
        opened: isOpened,
        openedAt: opened.get(item.id) ?? null,
        whatIf: done && hasWhatIf.has(item.id) ? item.what_if : null,
        whatIfOpened: whatIfOpened.has(item.id),
        bestScore,
        topTopic: topTopic.get(item.id)?.name ?? null,
        readMinutes: done && item.kind !== 'recipe' ? readMinutes(item.summary) : null,
        ingredientCount: ingredients.get(item.id) ?? null,
        reviewDueAt: review?.dueAt ?? null,
        reviewFormat: review?.format ?? null,
      };
    });
}

// ── Up next ──────────────────────────────────────────────────────────────────

/**
 * The one save to suggest at the top of the feed (A3; order from
 * docs/what-if.md Part C): a review card that's due (longest-waiting first) →
 * the newest unopened save with a what-if → the oldest unopened.
 * Snoozed and unfinished items are skipped.
 */
export function pickUpNext(items: FeedItem[], now: Date): { item: FeedItem; reason: UpNextReason } | null {
  const nowIso = now.toISOString();
  const eligible = items.filter((i) => i.status === 'done' && !(i.snoozed_until && i.snoozed_until > nowIso));
  const newestFirst = [...eligible].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const review = eligible
    .filter((i) => i.reviewDueAt && i.reviewDueAt <= nowIso)
    .sort((a, b) => a.reviewDueAt!.localeCompare(b.reviewDueAt!))[0];
  if (review) return { item: review, reason: 'review' };
  const whatIf = newestFirst.find((i) => i.state === 'new' && i.whatIf);
  if (whatIf) return { item: whatIf, reason: 'whatif' };
  const unread = newestFirst.findLast((i) => i.state === 'new');
  if (unread) return { item: unread, reason: 'unread' };
  return null;
}

// ── streak and week ──────────────────────────────────────────────────────────

/**
 * Consecutive local days with a save, an opened what-if, a lesson played or a review card (A6). One missed day
 * per Mon–Sun week is covered by a freeze; a second miss in that week ends the
 * streak. Today only counts once it has activity, so an empty morning doesn't
 * break yesterday's streak.
 */
export function streak(activityDays: Iterable<string>, now: Date, tz: string = DEFAULT_TZ): Streak {
  const active = new Set(activityDays);
  const today = localDate(now, tz);
  const activeToday = active.has(today);
  const first = [...active].sort()[0];

  let days = 0;
  let runStart: string | null = null;
  const frozen: string[] = [];
  if (first) {
    for (let d = activeToday ? today : addDays(today, -1); d >= first; d = addDays(d, -1)) {
      if (active.has(d)) {
        days++;
        runStart = d;
        continue;
      }
      const week = weekStart(d);
      if (frozen.some((f) => weekStart(f) === week)) break;
      frozen.push(d);
    }
  }
  // Only a miss inside the run used a freeze; one before its first day protected nothing.
  const thisWeek = weekStart(today);
  const spentThisWeek = frozen.some((f) => runStart !== null && f > runStart && weekStart(f) === thisWeek);
  const freezeLeft: 0 | 1 = spentThisWeek ? 0 : 1;
  return {
    days,
    freezeLeft,
    activeToday,
    atRisk: days > 0 && !activeToday && freezeLeft === 0 && localParts(now, tz).hour >= AT_RISK_HOUR,
    milestone: [...STREAK_MILESTONES].reverse().find((m) => days >= m) ?? null,
  };
}

/** This local week (Mon–Sun): which days had a save, and how many saves had their what-if opened. */
export function weekProgress(events: FeedInput['events'], now: Date, tz: string = DEFAULT_TZ): WeekProgress {
  const monday = weekStart(localDate(now, tz));
  const savedOn = Array<boolean>(7).fill(false);
  const opened = new Set<string>();
  for (const e of events) {
    const day = localDate(e.created_at, tz);
    if (day < monday) continue;
    const index = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${monday}T00:00:00Z`)) / DAY_MS);
    if (index > 6) continue;
    if (e.type === 'saved') savedOn[index] = true;
    if (e.type === 'whatif_open' && e.item_id) opened.add(e.item_id);
  }
  return { saveDays: savedOn.filter(Boolean).length, whatIfsOpened: opened.size, savedOn };
}

/** Days with a save, an opened what-if, a lesson played, or a review card done. */
export function activityDays(events: FeedInput['events'], reviews: FeedInput['reviews'] = [], tz: string = DEFAULT_TZ): string[] {
  return [
    ...events.filter((e) => e.type === 'saved' || e.type === 'played' || e.type === 'whatif_open').map((e) => localDate(e.created_at, tz)),
    ...reviews.map((r) => localDate(r.created_at, tz)),
  ];
}

// ── the whole feed ───────────────────────────────────────────────────────────

export function matchesFilter(item: FeedItem, filter: FeedFilter | undefined): boolean {
  if (filter === 'unread') return item.state === 'new';
  if (filter === 'whatif') return item.whatIf !== null && !item.whatIfOpened;
  if (filter === 'recipe') return item.kind === 'recipe';
  return true;
}

/** `tz` is the user's time zone: it decides what "today" and "this week" mean. */
export function buildFeed(input: FeedInput, opts: FeedOptions, now: Date, tz: string = DEFAULT_TZ): Feed {
  const all = feedItems(input);
  const inTopic = opts.topicId
    ? new Set(input.itemTopics.filter((l) => l.topic_id === opts.topicId).map((l) => l.item_id))
    : null;
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const filtered = all.filter(
    (i) => matchesFilter(i, opts.filter) && (!inTopic || inTopic.has(i.id)) && (!opts.before || i.created_at < opts.before),
  );
  return {
    items: filtered.slice(0, limit),
    hasMore: filtered.length > limit,
    upNext: pickUpNext(all, now),
    counts: {
      unread: all.filter((i) => matchesFilter(i, 'unread')).length,
      whatif: all.filter((i) => matchesFilter(i, 'whatif')).length,
    },
    streak: streak(activityDays(input.events, input.reviews, tz), now, tz),
    week: weekProgress(input.events, now, tz),
  };
}
