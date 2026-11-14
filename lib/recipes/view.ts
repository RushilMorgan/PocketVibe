/**
 * Recipes page and cooking view logic (docs/recipes.md). Pure and tested:
 * times, search, filters, which ingredients a step uses, and timers.
 */
import type { Recipe } from '@/lib/handlers/schemas';
import type { ItemSource } from '@/lib/supabase/database.types';

/** One recipe on the Recipes page. */
export interface RecipeSummary {
  id: string;
  title: string;
  url: string;
  source: ItemSource;
  thumbnail_url: string | null;
  created_at: string;
  description: string;
  servings: number;
  /** Prep + cook, when either could be read; null = unknown. */
  totalMinutes: number | null;
  ingredientCount: number;
  stepCount: number;
  tags: string[];
  /** Lowercase ingredient names, for search. */
  ingredients: string[];
  /** When it went on the Want to cook list; null = not on it. */
  wantToCookAt: string | null;
  cookedCount: number;
  lastCookedAt: string | null;
  /** Rating from the most recent cook that gave one. */
  rating: number | null;
}

/** One time a recipe was cooked. */
export interface Cook {
  id: string;
  /** 1–5; null = not rated. */
  rating: number | null;
  note: string | null;
  created_at: string;
}

export type RecipeFilter = 'want' | 'cooked' | 'untried' | 'quick';
/** "Quick" = this many minutes or fewer, start to finish. */
export const QUICK_MINUTES = 30;

/**
 * Seconds in a time written by the recipe prompt: "10 min", "1 hr 15 min",
 * "1.5 hours", "45 sec", "10-12 min" (the lower bound). Null if there's no time in it.
 */
export function parseSeconds(text: string | null | undefined): number | null {
  if (!text) return null;
  let total = 0;
  let found = false;
  for (const m of text.toLowerCase().matchAll(/(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?)?\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g)) {
    const n = Number(m[1].replace(',', '.'));
    const unit = m[2][0];
    total += unit === 'h' ? n * 3600 : unit === 'm' ? n * 60 : n;
    found = true;
  }
  return found && total > 0 ? Math.round(total) : null;
}

/** Prep + cook in whole minutes; null when neither has a time. */
export function totalMinutes(recipe: Pick<Recipe, 'prepTime' | 'cookTime'>): number | null {
  const prep = parseSeconds(recipe.prepTime);
  const cook = parseSeconds(recipe.cookTime);
  if (prep === null && cook === null) return null;
  return Math.max(1, Math.round(((prep ?? 0) + (cook ?? 0)) / 60));
}

/** 45 → "45 min", 75 → "1 h 15", 120 → "2 h". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

/** 245 → "4:05", 3725 → "1:02:05". Never negative. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Every word typed appears in the title, tags, ingredients or description. */
export function matchesQuery(recipe: RecipeSummary, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [recipe.title, recipe.description, ...recipe.tags, ...recipe.ingredients].join(' \n ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function matchesFilter(recipe: RecipeSummary, filter: RecipeFilter | null): boolean {
  switch (filter) {
    case 'want':
      return recipe.wantToCookAt !== null;
    case 'cooked':
      return recipe.cookedCount > 0;
    case 'untried':
      return recipe.cookedCount === 0;
    case 'quick':
      return recipe.totalMinutes !== null && recipe.totalMinutes <= QUICK_MINUTES;
    default:
      return true;
  }
}

/** Filtered, with the Want to cook list first (latest added on top), then newest saved. */
export function shownRecipes(
  recipes: RecipeSummary[],
  opts: { query?: string; filter?: RecipeFilter | null; tag?: string | null },
): RecipeSummary[] {
  return recipes
    .filter((r) => matchesFilter(r, opts.filter ?? null) && matchesQuery(r, opts.query ?? '') && (!opts.tag || r.tags.includes(opts.tag)))
    .sort((a, b) => {
      if (a.wantToCookAt || b.wantToCookAt) return (b.wantToCookAt ?? '').localeCompare(a.wantToCookAt ?? '');
      return b.created_at.localeCompare(a.created_at);
    });
}

/** The tags used by the most recipes (at least 2), most used first. */
export function topTags(recipes: RecipeSummary[], limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const r of recipes) for (const t of new Set(r.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([t]) => t);
}

/** Words too general to tie an ingredient to a step ("fresh", "sauce", "oil"). */
const GENERIC = new Set(
  'fresh large small medium big chopped sliced diced minced grated ground dried whole extra virgin powder sauce juice paste leaves leaf piece pieces clove cloves boneless skinless optional taste fine finely roughly plain white black green dark light unsalted salted cold warm room temperature'.split(' '),
);

const stem = (w: string) => (w.length > 4 ? w.replace(/(?:es|s)$/, '') : w);
const words = (text: string) => text.toLowerCase().replace(/\([^)]*\)/g, ' ').match(/[a-zà-ÿ]+/g) ?? [];

/**
 * Which ingredients a step mentions, by position in the ingredient list.
 * A guess from the words: an ingredient counts when one of its distinctive
 * words (not "fresh", "sauce"…) appears in the step, singular or plural.
 */
export function stepIngredients(stepText: string, ingredientNames: string[]): number[] {
  const inStep = new Set(words(stepText).map(stem));
  return ingredientNames.flatMap((name, i) => {
    const own = words(name.split(',')[0]);
    const distinctive = own.filter((w) => w.length >= 3 && !GENERIC.has(w));
    // "Oil" or "salt" alone: nothing distinctive is left, so match the name itself.
    const terms = distinctive.length ? distinctive : own;
    return terms.some((w) => inStep.has(stem(w))) ? [i] : [];
  });
}
