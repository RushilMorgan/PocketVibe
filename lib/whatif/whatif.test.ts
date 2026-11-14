import { describe, expect, it } from 'vitest';
import { cleanScenario, sameScenario, whatIf, whatIfDraft, type WhatIfDraft } from './schema';
import { citeText, finishWhatIf, siteOf, sourceList } from './shape';

const draft: WhatIfDraft = {
  today: [
    { fact: 'Toyota plans a solid-state car for 2027.', source: 1 },
    { fact: 'Cells cost about 4x lithium-ion today.', source: 3 },
    { fact: 'A fact with a dead source.', source: 2 },
  ],
  first_effects: ['Premium models get them first.', 'Charging stops get shorter.'],
  knock_on: ['Used petrol cars lose value faster.', 'Lithium miners lose pricing power.'],
  winners: ['Carmakers with their own cell plants', 'Fast-charging networks'],
  losers: ['Makers of today’s lithium-ion cells'],
  timeline: {
    near: { when: '2027–2028', what: 'First luxury models.' },
    medium: { when: '2029–2032', what: 'Mid-range cars.' },
    long: { when: '2033+', what: 'Most new cars.' },
  },
  likelihood: { level: 'low', why: 'Factories take years to build.' },
  signals: ['A carmaker gives a price and date.', 'A gigafactory starts production.', 'Cell cost drops below $100/kWh.'],
  other_scenarios: [' What if it flops? ', 'What if regulators step in?'],
};

const sources = [
  { url: 'https://www.reuters.com/a', site: 'reuters.com' },
  null, // Search source 2 led nowhere
  { url: 'https://example.com/b', site: 'example.com' },
];

describe('citeText', () => {
  const text = 'Toyota plans a car for 2027. Cells cost 4x more. Nobody knows the rest.';

  it('marks each backed stretch with its source numbers', () => {
    const out = citeText(text, [
      { text: 'Toyota plans a car for 2027.', sources: [0] },
      { text: 'Cells cost 4x more.', sources: [2, 1] },
    ]);
    expect(out).toBe('Toyota plans a car for 2027. [1] Cells cost 4x more. [2][3] Nobody knows the rest.');
  });

  it('merges marks on the same stretch and skips ones it cannot find', () => {
    const out = citeText(text, [
      { text: 'Cells cost 4x more.', sources: [0] },
      { text: 'Cells cost 4x more.', sources: [1] },
      { text: 'Not in the text.', sources: [2] },
    ]);
    expect(out).toBe('Toyota plans a car for 2027. Cells cost 4x more. [1][2] Nobody knows the rest.');
  });

  it('leaves text alone with no supports', () => {
    expect(citeText(text, [])).toBe(text);
  });

  it('handles supports that arrive out of order', () => {
    const out = citeText(text, [
      { text: 'Cells cost 4x more.', sources: [1] },
      { text: 'Toyota plans a car for 2027.', sources: [0] },
    ]);
    expect(out).toBe('Toyota plans a car for 2027. [1] Cells cost 4x more. [2] Nobody knows the rest.');
  });
});

describe('sources', () => {
  it('lists usable sources under Search’s own numbers', () => {
    expect(sourceList(sources)).toBe('[1] reuters.com\n[3] example.com');
    expect(sourceList([null])).toBe('');
  });

  it('reads the site from a link', () => {
    expect(siteOf('https://www.reuters.com/world/x?y=1')).toBe('reuters.com');
    expect(siteOf('mailto:a@b.c')).toBeNull();
    expect(siteOf('not a url')).toBeNull();
  });
});

describe('finishWhatIf', () => {
  const card = finishWhatIf(draft, 'What if solid-state batteries are in most new cars by 2030?', 'auto', sources);

  it('keeps only today-facts with a live source, and gives them its link', () => {
    expect(card.today).toEqual([
      { fact: 'Toyota plans a solid-state car for 2027.', url: 'https://www.reuters.com/a', site: 'reuters.com' },
      { fact: 'Cells cost about 4x lithium-ion today.', url: 'https://example.com/b', site: 'example.com' },
    ]);
  });

  it('drops every fact when Search found no sources', () => {
    expect(finishWhatIf(draft, 'What if?', 'custom', []).today).toEqual([]);
    expect(finishWhatIf({ ...draft, today: [{ fact: 'x', source: 0 }, { fact: 'y', source: -1 }] }, 'What if?', 'custom', sources).today).toEqual([]);
  });

  it('produces a card the stored schema accepts', () => {
    expect(whatIf.safeParse(card).success).toBe(true);
    expect(card).toMatchObject({ origin: 'auto', other_scenarios: ['What if it flops?', 'What if regulators step in?'] });
  });
});

describe('the draft schema', () => {
  it('needs exactly 3 signals, 2 other scenarios and at least one loser', () => {
    expect(whatIfDraft.safeParse(draft).success).toBe(true);
    expect(whatIfDraft.safeParse({ ...draft, signals: draft.signals.slice(0, 2) }).success).toBe(false);
    expect(whatIfDraft.safeParse({ ...draft, other_scenarios: ['What if it flops?'] }).success).toBe(false);
    expect(whatIfDraft.safeParse({ ...draft, losers: [] }).success).toBe(false);
    expect(whatIfDraft.safeParse({ ...draft, today: [] }).success).toBe(true);
  });
});

describe('scenarios', () => {
  it('tidies a typed scenario into one question', () => {
    expect(cleanScenario('  what if it\n never ships  ')).toBe('what if it never ships?');
    expect(cleanScenario('What if prices double.')).toBe('What if prices double?');
    expect(cleanScenario('What if it flops?')).toBe('What if it flops?');
    expect(cleanScenario('too short')).toBeNull();
    expect(cleanScenario('x'.repeat(201))).toBeNull();
  });

  it('spots the same question asked twice', () => {
    expect(sameScenario('What if it flops?', 'what if  it flops')).toBe(true);
    expect(sameScenario('What if it flops?', 'What if it works?')).toBe(false);
  });
});
