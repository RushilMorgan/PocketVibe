/**
 * Bringing old saves back (docs/saves-redesign.md B3): a recall card, or a
 * Then-and-now card when the save connects to another. Pure: worked out from
 * the `reviews` rows, so nothing else is stored.
 *
 * Schedule: 3 days after you first opened the save, then 10, then 30 days
 * after each review. "Got it" moves on a step, "Fuzzy" repeats the same gap,
 * "Forgot" starts again at 3 days. After the 30-day step it's done.
 */
import type { ReviewFormat, ReviewRating } from '@/lib/supabase/database.types';

export const REVIEW_DAYS = [3, 10, 30] as const;
const DAY_MS = 24 * 3600_000;

export interface ReviewLog {
  rating: ReviewRating;
  format: ReviewFormat;
  created_at: string;
}

export interface ReviewPlan {
  /** When the next card is due. */
  dueAt: string;
  /** 0-based step into REVIEW_DAYS. */
  step: number;
  /** Which card to show next. */
  format: ReviewFormat;
}

/**
 * The next review for a save, or null if it isn't eligible (never opened, or
 * a recipe) or is done (passed the 30-day step).
 */
export function reviewPlan(input: {
  firstOpenedAt: string | null;
  reviews: ReviewLog[];
  hasRelated: boolean;
  isRecipe: boolean;
}): ReviewPlan | null {
  if (input.isRecipe || !input.firstOpenedAt) return null;
  const sorted = [...input.reviews].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let step = 0;
  let from = input.firstOpenedAt;
  for (const r of sorted) {
    step = r.rating === 'got' ? step + 1 : r.rating === 'forgot' ? 0 : step;
    from = r.created_at;
  }
  if (step >= REVIEW_DAYS.length) return null;
  const last = sorted.at(-1);
  return {
    dueAt: new Date(Date.parse(from) + REVIEW_DAYS[step] * DAY_MS).toISOString(),
    step,
    // Then-and-now when there's a connection, but not twice in a row, so it stays fresh.
    format: input.hasRelated && last?.format !== 'connect' ? 'connect' : 'recall',
  };
}

export function isDue(plan: ReviewPlan | null, now: Date): boolean {
  return plan !== null && Date.parse(plan.dueAt) <= now.getTime();
}

/** "in 10 days", "tomorrow", for the card's done screen. */
export function nextReviewLabel(plan: ReviewPlan | null, now: Date): string {
  if (!plan) return "That's the last one — it's yours now.";
  const days = Math.max(1, Math.round((Date.parse(plan.dueAt) - now.getTime()) / DAY_MS));
  return days === 1 ? 'Next check: tomorrow.' : `Next check: in ${days} days.`;
}
