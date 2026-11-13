/**
 * The Settings "AI usage" card's numbers, from grouped `ai_usage` rows. Pure
 * and client-safe (the card imports the types and labels).
 */
import { costUsd, FREE_SEARCHES_PER_MONTH, SEARCH_QUERY_USD } from './pricing';

/** What each AI call was for. Add one here when a new feature calls a model. */
export const FEATURES = {
  watch: 'Watching videos',
  classify: 'Sorting saves',
  explainer: 'Explainers',
  recipe: 'Recipes',
  diagram: 'Diagrams',
  lesson: 'Lessons',
  index: 'Indexing for Ask',
  chat: 'Ask and chat',
  review: 'Review cards',
  topics: 'Topics',
  digest: 'Weekly digest',
  whatif: 'What if',
  council: 'Council',
  other: 'Other',
} as const;

export type Feature = keyof typeof FEATURES;

/** One grouped row from the ai_usage_by_feature / ai_usage_by_item functions. */
export interface UsageGroup {
  provider: 'gemini' | 'openrouter';
  model: string;
  /** Whether cost_usd was known when the calls were logged. */
  priced: boolean;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  cached_tokens: number;
  search_queries: number;
  /** Sum of the logged costs (0 when not priced). */
  cost_usd: number;
}

export interface FeatureGroup extends UsageGroup {
  /** Local month, 'YYYY-MM'. */
  month: string;
  feature: string;
}

export interface ItemGroup extends UsageGroup {
  item_id: string;
}

export interface MonthTotal {
  costUsd: number;
  calls: number;
  searches: number;
}

export interface UsageSummary {
  month: string;
  thisMonth: MonthTotal;
  lastMonth: MonthTotal;
  byFeature: { feature: string; label: string; costUsd: number; calls: number }[];
  /** Costliest saves this month; titles are filled in by the caller. */
  topSaves: { itemId: string; title: string | null; costUsd: number }[];
  /** Saves with any AI cost this month, and their average. Null when there are none. */
  perSave: { saves: number; avgUsd: number } | null;
  /** This month's Google searches and what they added (the first 5,000 a month are free on the account). */
  search: { queries: number; costUsd: number; freePerMonth: number };
  /** Models with no price in lib/ai/pricing.ts: left out of every total. */
  unpriced: { model: string; calls: number; tokens: number }[];
}

/**
 * A group's cost: what was logged, or — for calls logged before their model
 * had a price — today's rate, so adding a price fixes old rows too. Null if
 * there's still no price.
 */
export function groupCost(g: UsageGroup, now: Date): number | null {
  if (g.priced) return g.cost_usd;
  if (g.provider !== 'gemini') return null;
  return costUsd(
    g.model,
    {
      inputTokens: g.input_tokens,
      cachedTokens: g.cached_tokens,
      outputTokens: g.output_tokens,
      thinkingTokens: g.thinking_tokens,
      searchQueries: g.search_queries,
    },
    now,
  );
}

/** 'YYYY-MM' of the month before. */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

const round = (usd: number) => Math.round(usd * 1e6) / 1e6;

export function summarizeUsage(
  month: string,
  features: FeatureGroup[],
  items: ItemGroup[],
  now: Date,
): UsageSummary {
  const last = previousMonth(month);
  const totals = { [month]: { costUsd: 0, calls: 0, searches: 0 }, [last]: { costUsd: 0, calls: 0, searches: 0 } };
  const byFeature = new Map<string, { costUsd: number; calls: number }>();
  const unpriced = new Map<string, { calls: number; tokens: number }>();

  for (const g of features) {
    const total = totals[g.month];
    if (!total) continue;
    const cost = groupCost(g, now);
    total.calls += g.calls;
    total.searches += g.search_queries;
    if (cost === null) {
      if (g.month === month) {
        const u = unpriced.get(g.model) ?? { calls: 0, tokens: 0 };
        u.calls += g.calls;
        u.tokens += g.input_tokens + g.output_tokens + g.thinking_tokens;
        unpriced.set(g.model, u);
      }
      continue;
    }
    total.costUsd += cost;
    if (g.month !== month) continue;
    const f = byFeature.get(g.feature) ?? { costUsd: 0, calls: 0 };
    f.costUsd += cost;
    f.calls += g.calls;
    byFeature.set(g.feature, f);
  }

  const perItem = new Map<string, number>();
  for (const g of items) {
    const cost = groupCost(g, now);
    if (cost !== null) perItem.set(g.item_id, (perItem.get(g.item_id) ?? 0) + cost);
  }
  const itemCosts = [...perItem.entries()].sort((a, b) => b[1] - a[1]);
  const itemTotal = itemCosts.reduce((sum, [, c]) => sum + c, 0);

  const label = (f: string) => (f in FEATURES ? FEATURES[f as Feature] : f);
  const queries = totals[month].searches;
  return {
    month,
    thisMonth: { ...totals[month], costUsd: round(totals[month].costUsd) },
    lastMonth: { ...totals[last], costUsd: round(totals[last].costUsd) },
    byFeature: [...byFeature.entries()]
      .map(([feature, f]) => ({ feature, label: label(feature), costUsd: round(f.costUsd), calls: f.calls }))
      .sort((a, b) => b.costUsd - a.costUsd),
    topSaves: itemCosts.slice(0, 5).map(([itemId, c]) => ({ itemId, title: null, costUsd: round(c) })),
    perSave: itemCosts.length ? { saves: itemCosts.length, avgUsd: round(itemTotal / itemCosts.length) } : null,
    search: { queries, costUsd: round(queries * SEARCH_QUERY_USD), freePerMonth: FREE_SEARCHES_PER_MONTH },
    unpriced: [...unpriced.entries()].map(([model, u]) => ({ model, ...u })).sort((a, b) => b.tokens - a.tokens),
  };
}

/** "$0.42", "$0.0031", "$12.30": enough digits to see small amounts. */
export function formatUsd(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 0.01) return `$${usd.toPrecision(2)}`;
  return `$${usd.toFixed(2)}`;
}
