import { z } from 'zod';

/**
 * What if… cards (docs/what-if.md, Part B). Client-safe: the item page renders
 * these. Written in two steps (lib/whatif/service.ts): Search gathers today's
 * facts with their sources, then the smart model writes the rest as `draft`.
 */

/** Extra scenarios (suggested or typed) allowed per save. */
export const MAX_EXTRA_WHATIFS = 5;
export const SCENARIO_MAX = 200;

export const LIKELIHOODS = ['low', 'medium', 'high'] as const;
export type Likelihood = (typeof LIKELIHOODS)[number];

const line = z.string().min(1).max(240);

/** What the smart model returns. `today` picks facts by number from the Search step, so they can't be invented. */
export const whatIfDraft = z.object({
  today: z.array(z.number().int().min(1)).max(3).describe('Numbers of the 2–3 facts that best show where things stand now; [] if none fit'),
  first_effects: z.array(line).min(2).max(3).describe('What changes in the first year or two'),
  knock_on: z.array(line).min(2).max(3).describe('Second-order effects that follow from those'),
  winners: z.array(line).min(2).max(3),
  losers: z.array(line).min(1).max(3),
  timeline: z.object({
    near: z.object({ when: z.string().min(1).max(30), what: line }),
    medium: z.object({ when: z.string().min(1).max(30), what: line }),
    long: z.object({ when: z.string().min(1).max(30), what: line }),
  }),
  likelihood: z.enum(LIKELIHOODS),
  likelihood_why: line,
  signals: z.array(line).length(3).describe('Concrete, checkable signs it is actually happening'),
  alternatives: z.array(z.string().min(1).max(SCENARIO_MAX)).length(2).describe('Two other what-if questions on the same save'),
});

export type WhatIfDraft = z.infer<typeof whatIfDraft>;

export interface WhatIfSource {
  title: string;
  url: string;
}

/** The stored card (whatifs.content). */
export type WhatIfContent = Omit<WhatIfDraft, 'today'> & {
  today: { text: string; sources: WhatIfSource[] }[];
};

export type WhatIfKind = 'main' | 'alternative' | 'custom';
export type WhatIfStatus = 'pending' | 'done' | 'failed';

/** A what-if as the item page gets it. */
export interface WhatIf {
  id: string;
  item_id: string;
  scenario: string;
  kind: WhatIfKind;
  status: WhatIfStatus;
  content: WhatIfContent | null;
  error: string | null;
  opened_at: string | null;
  created_at: string;
}

export const LIKELIHOOD_LABEL: Record<Likelihood, string> = {
  low: 'Unlikely',
  medium: 'Could go either way',
  high: 'Likely',
};

/** The other scenarios to offer under a card: the main card's suggestions not yet asked. */
export function suggestedScenarios(whatifs: Pick<WhatIf, 'kind' | 'scenario' | 'content'>[]): string[] {
  const main = whatifs.find((w) => w.kind === 'main');
  const asked = new Set(whatifs.map((w) => normalizeScenario(w.scenario)));
  return (main?.content?.alternatives ?? []).filter((s) => !asked.has(normalizeScenario(s)));
}

export function normalizeScenario(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** "solid-state batteries everywhere" → "What if solid-state batteries everywhere?" — typed scenarios read as questions. */
export function asQuestion(input: string): string {
  let s = input.trim().replace(/\s+/g, ' ');
  if (!s) return s;
  // Lower-case the first letter unless it starts a name or acronym ("AI", "EU").
  const first = /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  if (!/^what if\b/i.test(s)) s = `What if ${first}`;
  else s = `What if${s.slice(7)}`;
  return /[?!.]$/.test(s) ? s.replace(/[.!]$/, '?') : `${s}?`;
}
