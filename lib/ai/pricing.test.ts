import { describe, expect, it } from 'vitest';
import { costUsd, pricingFor, rateFor, SEARCH_QUERY_USD } from './pricing';

const nov = new Date('2026-11-13T10:00:00Z');
const dec = new Date('2026-12-01T00:00:00Z');

describe('rateFor', () => {
  it('follows the dated launch prices', () => {
    expect(rateFor('gemini-4-argon', nov)).toEqual({ input: 2, output: 10, cachedInput: 0.1 });
    expect(rateFor('gemini-4-argon', dec)).toEqual({ input: 4, output: 20, cachedInput: 0.2 });
    expect(rateFor('gemini-3.8-flash', new Date('2026-12-31T23:59:59Z'))?.input).toBe(0.75);
    expect(rateFor('gemini-3.8-flash', new Date('2027-01-01T00:00:00Z'))?.input).toBe(1.5);
  });

  it('uses the long-context rate above 200k prompt tokens', () => {
    expect(rateFor('gemini-3.1-pro-preview', nov, 200_000)?.input).toBe(2);
    expect(rateFor('gemini-3.1-pro-preview', nov, 200_001)?.input).toBe(4);
  });

  it('matches model variants by prefix, and knows nothing of other models', () => {
    expect(pricingFor('gemini-3.1-pro-preview-customtools')).toBe(pricingFor('gemini-3.1-pro-preview'));
    expect(rateFor('gemini-9-unknown', nov)).toBeNull();
  });
});

describe('costUsd', () => {
  it('bills thinking as output and cached input at the cached rate', () => {
    // Argon in Nov: 700 uncached × $2 + 300 cached × $0.10 + (50 + 70) × $10, per 1M.
    const cost = costUsd('gemini-4-argon', { inputTokens: 1000, cachedTokens: 300, outputTokens: 50, thinkingTokens: 70 }, nov);
    expect(cost).toBeCloseTo((700 * 2 + 300 * 0.1 + 120 * 10) / 1e6, 12);
  });

  it('adds Google searches', () => {
    const cost = costUsd('gemini-3.8-flash', { inputTokens: 0, outputTokens: 0, searchQueries: 3 }, nov);
    expect(cost).toBeCloseTo(3 * SEARCH_QUERY_USD, 12);
  });

  it('is null for a model with no price', () => {
    expect(costUsd('gemini-9-unknown', { inputTokens: 10, outputTokens: 10 }, nov)).toBeNull();
  });
});
