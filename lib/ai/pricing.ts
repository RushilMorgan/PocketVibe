/**
 * Gemini list prices, for the AI usage estimate (lib/ai/usage.ts). Pure and
 * client-safe. Copied from https://ai.google.dev/gemini-api/docs/pricing
 * (Standard tier) on 2026-11-13 — re-check it when a model changes or a dated
 * price below comes into effect. Google's bill is the real number; this is an
 * estimate from the token counts each response reports.
 *
 * OpenRouter (the Council) reports its own cost per call, so it isn't priced here.
 */

/** USD per 1M tokens. Thinking tokens are billed as output. */
export interface Rate {
  input: number;
  output: number;
  /** Implicitly cached input tokens; defaults to the input price. */
  cachedInput?: number;
}

interface Period {
  /** First UTC day this rate no longer applies (exclusive); omit on the last period. */
  until?: string;
  rate: Rate;
}

interface ModelPricing {
  periods: Period[];
  /** A dearer rate for prompts above this many tokens. */
  longContext?: { overTokens: number; rate: Rate };
}

export const PRICES: Record<string, ModelPricing> = {
  // Launch pricing doubles on 1 Dec 2026.
  'gemini-4-argon': {
    periods: [
      { until: '2026-12-01', rate: { input: 2, output: 10, cachedInput: 0.1 } },
      { rate: { input: 4, output: 20, cachedInput: 0.2 } },
    ],
  },
  // Launch pricing doubles on 1 Jan 2027.
  'gemini-3.8-flash': {
    periods: [
      { until: '2027-01-01', rate: { input: 0.75, output: 3.75, cachedInput: 0.075 } },
      { rate: { input: 1.5, output: 7.5, cachedInput: 0.15 } },
    ],
  },
  'gemini-3.1-pro-preview': {
    periods: [{ rate: { input: 2, output: 12, cachedInput: 0.2 } }],
    longContext: { overTokens: 200_000, rate: { input: 4, output: 18, cachedInput: 0.4 } },
  },
  'gemini-embedding-001': { periods: [{ rate: { input: 0.15, output: 0 } }] },
};

/**
 * Grounding with Google Search on Gemini 3 and newer: $14 per 1,000 search
 * queries (one grounded call can run several). The first 5,000 a month are
 * free across the whole Google account — not subtracted here, because the
 * allowance is shared with anything else using the same key.
 */
export const SEARCH_QUERY_USD = 14 / 1000;
export const FREE_SEARCHES_PER_MONTH = 5000;

export interface Tokens {
  /** All prompt tokens, cached ones and tool-use (search result) tokens included. */
  inputTokens: number;
  cachedTokens?: number;
  outputTokens: number;
  thinkingTokens?: number;
  searchQueries?: number;
}

/** The pricing entry for a model id: exact, else the longest id it starts with (e.g. a `-customtools` variant). */
export function pricingFor(model: string): ModelPricing | null {
  if (PRICES[model]) return PRICES[model];
  const key = Object.keys(PRICES)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? PRICES[key] : null;
}

/** The rate in effect at `at`, or null if the model isn't in the table. */
export function rateFor(model: string, at: Date, inputTokens = 0): Rate | null {
  const pricing = pricingFor(model);
  if (!pricing) return null;
  if (pricing.longContext && inputTokens > pricing.longContext.overTokens) return pricing.longContext.rate;
  const day = at.toISOString().slice(0, 10);
  return (pricing.periods.find((p) => !p.until || day < p.until) ?? pricing.periods.at(-1)!).rate;
}

/** Estimated USD for one call (or a sum of calls on one model), or null if the model has no price yet. */
export function costUsd(model: string, t: Tokens, at: Date): number | null {
  const rate = rateFor(model, at, t.inputTokens);
  if (!rate) return null;
  const cached = Math.min(t.cachedTokens ?? 0, t.inputTokens);
  const tokens =
    (t.inputTokens - cached) * rate.input +
    cached * (rate.cachedInput ?? rate.input) +
    (t.outputTokens + (t.thinkingTokens ?? 0)) * rate.output;
  return tokens / 1_000_000 + (t.searchQueries ?? 0) * SEARCH_QUERY_USD;
}
