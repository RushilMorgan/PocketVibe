import { describe, expect, it } from 'vitest';
import { formatUsd, previousMonth, summarizeUsage, type FeatureGroup, type ItemGroup, type UsageGroup } from './usage-summary';

const now = new Date('2026-11-13T10:00:00Z');
const base: UsageGroup = {
  provider: 'gemini',
  model: 'gemini-4-argon',
  priced: true,
  calls: 1,
  input_tokens: 0,
  output_tokens: 0,
  thinking_tokens: 0,
  cached_tokens: 0,
  search_queries: 0,
  cost_usd: 0,
};
const feature = (f: Partial<FeatureGroup>): FeatureGroup => ({ ...base, month: '2026-11', feature: 'explainer', ...f });
const item = (f: Partial<ItemGroup>): ItemGroup => ({ ...base, item_id: 'a', ...f });

describe('summarizeUsage', () => {
  it('splits this month from last and ranks features by cost', () => {
    const s = summarizeUsage(
      '2026-11',
      [
        feature({ feature: 'explainer', cost_usd: 0.3, calls: 3 }),
        feature({ feature: 'chat', cost_usd: 0.5, calls: 2 }),
        feature({ feature: 'digest', cost_usd: 0.1, search_queries: 4 }),
        feature({ month: '2026-10', cost_usd: 2 }),
        feature({ month: '2026-09', cost_usd: 9 }),
      ],
      [],
      now,
    );
    expect(s.thisMonth).toEqual({ costUsd: 0.9, calls: 6, searches: 4 });
    expect(s.lastMonth.costUsd).toBe(2);
    expect(s.byFeature.map((f) => f.label)).toEqual(['Ask and chat', 'Explainers', 'Weekly digest']);
    expect(s.search.queries).toBe(4);
  });

  it('prices rows logged before their model had a price, and lists models still unpriced', () => {
    const s = summarizeUsage(
      '2026-11',
      [
        feature({ priced: false, input_tokens: 1_000_000 }), // Argon, now priced: $2
        feature({ priced: false, model: 'gemini-9-unknown', input_tokens: 500, output_tokens: 20, calls: 4 }),
      ],
      [],
      now,
    );
    expect(s.thisMonth.costUsd).toBe(2);
    expect(s.unpriced).toEqual([{ model: 'gemini-9-unknown', calls: 4, tokens: 520 }]);
  });

  it('sums each save across models and averages over saves', () => {
    const s = summarizeUsage(
      '2026-11',
      [],
      [
        item({ item_id: 'a', cost_usd: 0.1 }),
        item({ item_id: 'a', model: 'gemini-3.8-flash', cost_usd: 0.02 }),
        item({ item_id: 'b', cost_usd: 0.3 }),
      ],
      now,
    );
    expect(s.topSaves.map((t) => [t.itemId, t.costUsd])).toEqual([
      ['b', 0.3],
      ['a', 0.12],
    ]);
    expect(s.perSave).toEqual({ saves: 2, avgUsd: 0.21 });
  });

  it('has no per-save figure without saves', () => {
    expect(summarizeUsage('2026-11', [], [], now).perSave).toBeNull();
  });
});

describe('previousMonth', () => {
  it('wraps the year', () => {
    expect(previousMonth('2026-11')).toBe('2026-10');
    expect(previousMonth('2027-01')).toBe('2026-12');
  });
});

describe('formatUsd', () => {
  it('keeps small amounts readable', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(12.3)).toBe('$12.30');
    expect(formatUsd(0.0031)).toBe('$0.0031');
    expect(formatUsd(0.00001)).toBe('<$0.0001');
  });
});
