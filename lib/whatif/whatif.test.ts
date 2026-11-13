import { describe, expect, it } from 'vitest';
import { groundedFacts, numberedFacts } from './facts';
import { asQuestion, suggestedScenarios, whatIfDraft } from './schema';

describe('groundedFacts', () => {
  const text = [
    'Here is what I found:',
    '- **Toyota** plans to sell cars with solid-state batteries from 2027.',
    '- Solid-state cells cost about 4x more than lithium-ion today.',
    '- Many experts are excited about the future.',
    '* QuantumScape shipped B-sample cells to VW in 2025.',
  ].join('\n');
  const supports = [
    { text: 'Toyota** plans to sell cars with solid-state batteries from 2027.', sources: [0] },
    { text: 'QuantumScape shipped B-sample cells to VW in 2025.', sources: [2, 1, 3] },
    { text: 'cost about 4x more', sources: [] },
  ];

  it('keeps only lines Search backed, cleaned, with their sources', () => {
    expect(groundedFacts(text, supports)).toEqual([
      { text: 'Toyota plans to sell cars with solid-state batteries from 2027.', sources: [0] },
      { text: 'QuantumScape shipped B-sample cells to VW in 2025.', sources: [2, 1] },
    ]);
  });

  it('numbers facts for the prompt, or says there are none', () => {
    expect(numberedFacts(groundedFacts(text, supports))).toBe(
      '[1] Toyota plans to sell cars with solid-state batteries from 2027.\n[2] QuantumScape shipped B-sample cells to VW in 2025.',
    );
    expect(numberedFacts([])).toMatch(/leave "today" empty/);
  });
});

describe('asQuestion', () => {
  it('turns a typed scenario into a what-if question', () => {
    expect(asQuestion('it flops')).toBe('What if it flops?');
    expect(asQuestion('Regulators ban it.')).toBe('What if regulators ban it?');
    expect(asQuestion('AI writes all the code')).toBe('What if AI writes all the code?');
    expect(asQuestion('what if the EU steps in')).toBe('What if the EU steps in?');
    expect(asQuestion('  What if   prices halve?  ')).toBe('What if prices halve?');
  });
});

describe('suggestedScenarios', () => {
  it("offers the main card's alternatives not yet asked", () => {
    const content = { alternatives: ['What if it flops?', 'What if regulators step in?'] } as never;
    expect(
      suggestedScenarios([
        { kind: 'main', scenario: 'What if X?', content },
        { kind: 'alternative', scenario: 'what if it  flops?', content: null },
      ]),
    ).toEqual(['What if regulators step in?']);
    expect(suggestedScenarios([{ kind: 'main', scenario: 'What if X?', content: null }])).toEqual([]);
  });
});

describe('whatIfDraft', () => {
  const draft = {
    today: [1, 2],
    first_effects: ['a', 'b'],
    knock_on: ['c', 'd'],
    winners: ['e', 'f'],
    losers: ['g'],
    timeline: { near: { when: '2027', what: 'h' }, medium: { when: '2030', what: 'i' }, long: { when: '2035+', what: 'j' } },
    likelihood: 'medium',
    likelihood_why: 'k',
    signals: ['l', 'm', 'n'],
    alternatives: ['What if it flops?', 'What if regulators step in?'],
  };

  it('accepts a full card and insists on exactly 3 signals and a loser', () => {
    expect(whatIfDraft.safeParse(draft).success).toBe(true);
    expect(whatIfDraft.safeParse({ ...draft, signals: ['l', 'm'] }).success).toBe(false);
    expect(whatIfDraft.safeParse({ ...draft, losers: [] }).success).toBe(false);
  });
});
