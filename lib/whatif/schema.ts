import { z } from 'zod';

/**
 * What if… (docs/what-if.md Part B): item_outputs.content for type 'whatif'.
 * Shared by the server (validating AI output) and the client (rendering), so
 * no server-only imports here.
 */

/** Other and custom scenarios allowed per save, on top of the automatic one. */
export const MAX_EXTRA = 5;
export const SCENARIO_MIN = 12;
export const SCENARIO_MAX = 200;

const line = z.string().min(1).max(280);
const phase = z.object({
  when: z.string().min(1).max(40).describe('Rough years, e.g. "2027–2028"'),
  what: line,
});

/** What the model writes. `today` points at numbered sources; code swaps in the real links. */
export const whatIfDraft = z.object({
  today: z
    .array(
      z.object({
        fact: line.describe('One fact about where things stand now, with its number'),
        source: z.number().int().describe('The n of the [n] source that backs this fact'),
      }),
    )
    .max(3)
    .describe('2–3 facts taken only from the search notes; empty if the notes have none'),
  first_effects: z.array(line).min(2).max(3).describe('What changes in the first year or two'),
  knock_on: z.array(line).min(2).max(3).describe('Second-order effects that are less obvious'),
  winners: z.array(line).min(2).max(3).describe('Real kinds of players who gain: companies, jobs, countries'),
  losers: z.array(line).min(1).max(3).describe('Real kinds of players who lose'),
  timeline: z.object({ near: phase, medium: phase, long: phase }),
  likelihood: z.object({
    level: z.enum(['low', 'medium', 'high']),
    why: line.describe('One line on why, honestly'),
  }),
  signals: z.array(line).length(3).describe('Exactly 3 concrete, checkable events that would show this is happening'),
  other_scenarios: z
    .array(z.string().min(1).max(SCENARIO_MAX))
    .length(2)
    .describe('2 short alternative what-if questions, e.g. "What if it flops?"'),
});

export type WhatIfDraft = z.infer<typeof whatIfDraft>;

export const whatIfOrigin = z.enum(['auto', 'other', 'custom']);
export type WhatIfOrigin = z.infer<typeof whatIfOrigin>;

/** The stored card. */
export const whatIf = whatIfDraft.extend({
  scenario: z.string().min(1).max(SCENARIO_MAX),
  /** auto = written with the save; other = one of the suggested scenarios; custom = the user's own. */
  origin: whatIfOrigin,
  today: z.array(z.object({ fact: line, url: z.url(), site: z.string() })).max(3),
});

export type WhatIf = z.infer<typeof whatIf>;

/** A page Search read, followed to its real address. */
export interface WhatIfSource {
  url: string;
  site: string;
}

export const LIKELIHOOD_LABEL: Record<WhatIf['likelihood']['level'], string> = {
  low: 'Unlikely',
  medium: 'Could happen',
  high: 'Likely',
};

/** Same question, ignoring case, spacing and the final "?". */
export function sameScenario(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[?.!\s]+$/g, '').replace(/\s+/g, ' ').trim();
  return norm(a) === norm(b);
}

/** Tidies a typed scenario: one line, ends with "?". Null if it's too short or too long to be one. */
export function cleanScenario(raw: string): string | null {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length < SCENARIO_MIN || text.length > SCENARIO_MAX) return null;
  return /[?]$/.test(text) ? text : `${text.replace(/[.!]+$/, '')}?`.slice(0, SCENARIO_MAX);
}
