/**
 * Scaling a recipe to a different number of servings, grouping ingredients,
 * the shopping list, and "What can I make?" (docs/recipes.md, second set).
 * Pure and tested. Quantities are the plain text the recipe prompt writes
 * ("1/2", "1 1/2", "2-3", "a pinch"), so anything that isn't a number is
 * left exactly as written.
 */
import type { Recipe } from '@/lib/handlers/schemas';
import { sameWord, type RecipeSummary } from './view';

const UNICODE: Record<string, number> = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 };
const FRACTIONS: [number, string][] = [
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
];
const NUMBER = String.raw`\d+\s+\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d*[½⅓⅔¼¾⅛⅜⅝⅞]|\d+(?:[.,]\d+)?`;

/** One number as the prompt writes it: "2", "1.5", "1/2", "1 1/2", "½", "1½". Null if it isn't one. */
export function parseNumber(text: string): number | null {
  const t = text.trim();
  let m = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null;
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  m = t.match(/^(\d*)([½⅓⅔¼¾⅛⅜⅝⅞])$/);
  if (m) return Number(m[1] || 0) + UNICODE[m[2]];
  return /^\d+(?:[.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : null;
}

/** 0.5 → "1/2", 1.5 → "1 1/2", 2.33 → "2 1/3", 1200 → "1200", 0.05 → "a little". Kitchen-friendly, not exact. */
export function formatNumber(n: number): string {
  if (n >= 20) return String(Math.round(n));
  if (n >= 10) return String(Math.round(n * 2) / 2);
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  if (rest < 0.06) return whole > 0 ? String(whole) : 'a little';
  if (rest > 0.94) return String(whole + 1);
  const [, label] = FRACTIONS.reduce((best, f) => (Math.abs(f[0] - rest) < Math.abs(best[0] - rest) ? f : best));
  return whole > 0 ? `${whole} ${label}` : label;
}

/**
 * A quantity scaled by `factor`: "1/2" × 2 → "1", "2-3" × 2 → "4-6",
 * "a pinch" → "a pinch". At factor 1 the text is returned untouched.
 */
export function scaleQuantity(quantity: string, factor: number): string {
  if (factor === 1 || !quantity.trim()) return quantity;
  const range = quantity.trim().match(new RegExp(`^(${NUMBER})\\s*(?:-|–|to)\\s*(${NUMBER})$`));
  if (range) {
    const [a, b] = [parseNumber(range[1]), parseNumber(range[2])];
    if (a !== null && b !== null) return `${formatNumber(a * factor)}-${formatNumber(b * factor)}`;
  }
  const n = parseNumber(quantity);
  return n === null ? quantity : formatNumber(n * factor);
}

/** The servings the stepper offers: 1 up to at least 12, or four times the recipe's own. */
export function maxServings(base: number): number {
  return Math.max(12, base * 4);
}

export interface IngredientLine {
  /** Position in the recipe's ingredient list (ticks are stored by this). */
  index: number;
  emoji: string;
  name: string;
  /** Scaled quantity and unit, e.g. "1 1/2 cup"; empty when the recipe gives none. */
  amount: string;
}

export interface IngredientGroup {
  /** "Sauce", "Dough"…; null when the recipe isn't split into parts. */
  name: string | null;
  lines: IngredientLine[];
}

/**
 * Ingredients with scaled amounts, under their group headings. A recipe is
 * only shown in groups when it names at least two; otherwise one plain list.
 * Groups keep the order they first appear in.
 */
export function ingredientGroups(recipe: Pick<Recipe, 'ingredients'>, factor = 1): IngredientGroup[] {
  const lines = recipe.ingredients.map((ing, index) => ({
    index,
    emoji: ing.emoji,
    name: ing.name,
    amount: [scaleQuantity(ing.quantity, factor), ing.unit].filter(Boolean).join(' '),
    group: ing.group?.trim() || null,
  }));
  const names = [...new Set(lines.map((l) => l.group).filter((g): g is string => g !== null))];
  const strip = ({ group: _group, ...line }: (typeof lines)[number]): IngredientLine => line;
  if (names.length < 2) return [{ name: null, lines: lines.map(strip) }];
  const groups: IngredientGroup[] = names.map((name) => ({ name, lines: lines.filter((l) => l.group === name).map(strip) }));
  const loose = lines.filter((l) => l.group === null).map(strip);
  return loose.length ? [...groups, { name: 'Everything else', lines: loose }] : groups;
}

/** A plain-text shopping list of what isn't ticked off yet, for pasting into a notes or shopping app. */
export function shoppingList(recipe: Pick<Recipe, 'title' | 'ingredients'>, opts: { factor?: number; servings?: number; have?: number[] } = {}): string {
  const have = new Set(opts.have ?? []);
  const lines = ingredientGroups(recipe, opts.factor ?? 1).flatMap((g) => {
    const left = g.lines.filter((l) => !have.has(l.index));
    if (!left.length) return [];
    return [...(g.name ? [`${g.name}:`] : []), ...left.map((l) => `- ${[l.amount, l.name].filter(Boolean).join(' ')}`)];
  });
  const heading = opts.servings ? `${recipe.title} (serves ${opts.servings})` : recipe.title;
  return [heading, ...lines].join('\n');
}

// ── What can I make? ─────────────────────────────────────────────────────────

/** "Chicken, rice and garlic" → ["chicken", "rice", "garlic"]. */
export function parseHave(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/,|\n|;|\band\b/).map((t) => t.replace(/[^a-zà-ÿ\s-]/g, ' ').replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 2))];
}

export interface MakeMatch {
  recipe: RecipeSummary;
  /** Which of the things you have this recipe uses. */
  matched: string[];
  /** How many of its ingredients none of your things cover. */
  missing: number;
}

/**
 * Recipes ranked by how many of the things you have they use (singular or
 * plural), then by how few other ingredients they need. Recipes using none
 * are left out.
 */
export function whatCanIMake(recipes: RecipeSummary[], have: string[]): MakeMatch[] {
  const terms = have.map((h) => ({ raw: h, words: h.split(' ') }));
  return recipes
    .flatMap((recipe) => {
      const names = recipe.ingredients.map((name) => name.match(/[a-zà-ÿ]+/g) ?? []);
      const covers = (t: (typeof terms)[number], words: string[]) => t.words.every((w) => words.some((x) => sameWord(w, x)));
      const matched = terms.filter((t) => names.some((words) => covers(t, words)));
      if (!matched.length) return [];
      const missing = names.filter((words) => !terms.some((t) => covers(t, words))).length;
      return [{ recipe, matched: matched.map((t) => t.raw), missing }];
    })
    .sort((a, b) => b.matched.length - a.matched.length || a.missing - b.missing || b.recipe.created_at.localeCompare(a.recipe.created_at));
}
