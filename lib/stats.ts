/**
 * "Your stats" (the Stats page): how the app is actually being used, worked
 * out from plain rows. Pure and tested; lib/stats-service.ts loads the rows.
 */
import { DEFAULT_TZ, localDate } from '@/lib/time';
import type { EventType, ItemKind, ItemStatus } from '@/lib/supabase/database.types';

const DAY_MS = 24 * 3600_000;
const WEEKS = 8;
const KINDS: ItemKind[] = ['tech', 'news', 'recipe', 'other'];

export interface StatsInput {
  items: { id: string; kind: ItemKind | null; status: ItemStatus; created_at: string; cook_list_at: string | null }[];
  events: { item_id: string | null; type: EventType; created_at: string }[];
  /** Saves with a what-if card written. */
  whatIfs: { item_id: string }[];
  reviews: { item_id: string; created_at: string }[];
  cooks: { item_id: string; created_at: string }[];
}

export interface KindStats {
  kind: ItemKind;
  saves: number;
  /** Opened at least once. */
  opened: number;
  /** Opened again more than a day after it was saved. */
  cameBack: number;
}

export interface Stats {
  saves: { total: number; last7: number; last30: number; failed: number };
  /** Of finished saves. */
  opens: { opened: number; neverOpened: number; moreThanOnce: number; cameBack: number };
  byKind: KindStats[];
  whatIfs: { written: number; opened: number };
  recipes: { saved: number; wantToCook: number; cooked: number; timesCooked: number };
  reviewsDone: number;
  lessonsPlayed: number;
  digestTaps: number;
  /** The last 8 local weeks (Mon–Sun), oldest first. */
  weeks: { start: string; saves: number; opens: number }[];
}

function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - dow * DAY_MS).toISOString().slice(0, 10);
}

export function buildStats(input: StatsInput, now: Date, tz: string = DEFAULT_TZ): Stats {
  const t = now.getTime();
  const done = input.items.filter((i) => i.status === 'done');
  const createdAt = new Map(input.items.map((i) => [i.id, Date.parse(i.created_at)]));

  const openCount = new Map<string, number>();
  const cameBack = new Set<string>();
  const whatIfOpened = new Set<string>();
  let lessonsPlayed = 0;
  let digestTaps = 0;
  for (const e of input.events) {
    if (e.type === 'played') lessonsPlayed++;
    if (e.type === 'digest_open') digestTaps++;
    if (!e.item_id) continue;
    if (e.type === 'whatif_open') whatIfOpened.add(e.item_id);
    if (e.type !== 'opened') continue;
    openCount.set(e.item_id, (openCount.get(e.item_id) ?? 0) + 1);
    const saved = createdAt.get(e.item_id);
    if (saved !== undefined && Date.parse(e.created_at) - saved > DAY_MS) cameBack.add(e.item_id);
  }

  const opened = done.filter((i) => openCount.has(i.id));
  const byKind = KINDS.map((kind) => {
    const ofKind = done.filter((i) => (i.kind ?? 'other') === kind);
    return {
      kind,
      saves: ofKind.length,
      opened: ofKind.filter((i) => openCount.has(i.id)).length,
      cameBack: ofKind.filter((i) => cameBack.has(i.id)).length,
    };
  });

  const withWhatIf = new Set(input.whatIfs.map((w) => w.item_id));
  const recipes = done.filter((i) => i.kind === 'recipe');
  const recipeIds = new Set(recipes.map((r) => r.id));
  const recipeCooks = input.cooks.filter((c) => recipeIds.has(c.item_id));

  const thisMonday = mondayOf(localDate(now, tz));
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(Date.parse(`${thisMonday}T00:00:00Z`) - (WEEKS - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10);
    return { start, saves: 0, opens: 0 };
  });
  const weekOf = new Map(weeks.map((w) => [w.start, w]));
  for (const i of input.items) {
    const w = weekOf.get(mondayOf(localDate(i.created_at, tz)));
    if (w) w.saves++;
  }
  for (const e of input.events) {
    if (e.type !== 'opened') continue;
    const w = weekOf.get(mondayOf(localDate(e.created_at, tz)));
    if (w) w.opens++;
  }

  return {
    saves: {
      total: input.items.length,
      last7: input.items.filter((i) => t - Date.parse(i.created_at) <= 7 * DAY_MS).length,
      last30: input.items.filter((i) => t - Date.parse(i.created_at) <= 30 * DAY_MS).length,
      failed: input.items.filter((i) => i.status === 'failed').length,
    },
    opens: {
      opened: opened.length,
      neverOpened: done.length - opened.length,
      moreThanOnce: done.filter((i) => (openCount.get(i.id) ?? 0) >= 2).length,
      cameBack: done.filter((i) => cameBack.has(i.id)).length,
    },
    byKind,
    whatIfs: { written: withWhatIf.size, opened: [...withWhatIf].filter((id) => whatIfOpened.has(id)).length },
    recipes: {
      saved: recipes.length,
      wantToCook: recipes.filter((r) => r.cook_list_at).length,
      cooked: new Set(recipeCooks.map((c) => c.item_id)).size,
      timesCooked: recipeCooks.length,
    },
    reviewsDone: input.reviews.length,
    lessonsPlayed,
    digestTaps,
    weeks,
  };
}
