import { z } from 'zod';

/**
 * Playbook (docs/playbook.md): the frameworks pulled out of saves, and an idea
 * worked through them. Shared by the server (validating AI output) and the
 * client (rendering), so no server-only imports here.
 */

/** Frameworks pulled from one save at most. */
export const MAX_PER_SAVE = 4;
/** Frameworks one idea is worked through at most. */
export const MAX_LENSES = 3;
/** Runs per user per 24 h. */
export const RUNS_PER_DAY = 20;
export const IDEA_MIN = 15;
export const IDEA_MAX = 4000;

export const FRAMEWORK_KINDS = ['framework', 'mental_model', 'principle', 'process', 'rule_of_thumb'] as const;
export type FrameworkKind = (typeof FRAMEWORK_KINDS)[number];

export const KIND_LABEL: Record<FrameworkKind, string> = {
  framework: 'Framework',
  mental_model: 'Mental model',
  principle: 'Principle',
  process: 'Process',
  rule_of_thumb: 'Rule of thumb',
};

const line = z.string().min(1).max(300);

/** One framework as the model writes it. */
export const framework = z.object({
  name: z
    .string()
    .min(2)
    .max(80)
    .describe('Its real name if it has one ("Jobs to be done"), else a plain 2–5 word name. No "The", no author'),
  kind: z.enum(FRAMEWORK_KINDS),
  from: z.string().max(80).nullable().describe('Who the content credits it to. null unless the content says'),
  gist: z.string().min(1).max(240).describe('One plain sentence: what it is and what it is for'),
  parts: z
    .array(
      z.object({
        label: z.string().min(1).max(80).describe('The step or component, e.g. "Acquisition"'),
        detail: z.string().max(300).describe('One plain line on what it means or what to do'),
      }),
    )
    .max(8)
    .describe('Its steps or components, in order. Empty for a single principle or rule with no parts'),
  use_when: line.describe('The kind of situation or decision it helps with'),
  watch_out: line.nullable().describe('Where it misleads or breaks down. null if the content gives no limit and none is well known'),
  example: z.string().max(400).nullable().describe('The example the content itself gives, in one or two lines. null if it gives none'),
  questions: z
    .array(z.string().min(1).max(200))
    .min(2)
    .max(4)
    .describe('Questions it makes you ask of your own idea or business, each answerable without the source'),
  areas: z.array(z.string().min(1).max(30)).min(1).max(3).describe('1–2 word lowercase areas it applies to, e.g. "pricing", "strategy", "habits"'),
});

export type FrameworkDraft = z.infer<typeof framework>;

export const extraction = z.object({
  frameworks: z.array(framework).max(MAX_PER_SAVE).describe('Empty when the content teaches nothing reusable'),
});

/** `frameworks.content`: everything but the name, which has its own column. */
export type FrameworkContent = Omit<FrameworkDraft, 'name'>;

/** A framework in the playbook, with the saves it came from. */
export interface Framework extends FrameworkDraft {
  id: string;
  createdAt: string;
  sources: { itemId: string; title: string | null }[];
}

/** Which frameworks fit an idea: numbers from the list the picker was shown. */
export const pick = z.object({
  picks: z.array(z.number().int()).max(MAX_LENSES).describe('The numbers of the frameworks that genuinely help, best first. Empty if none do'),
});

const lensBody = {
  why: line.describe('One line on why this framework fits this idea'),
  points: z
    .array(
      z.object({
        label: z.string().min(1).max(80).describe("The framework's part or question this point answers"),
        finding: z.string().min(1).max(400).describe('What it says about this idea, specifically'),
      }),
    )
    .min(2)
    .max(8)
    .describe('The idea walked through the framework: one point per part when it has parts'),
  insight: z.string().min(1).max(400).describe('The single most useful thing this framework shows about the idea'),
  unknowns: z.array(z.string().min(1).max(240)).max(3).describe('What you would need to find out before trusting this; things the idea does not say'),
};

/** What the model writes. `framework` points at a numbered framework; code swaps in the real one. */
export const runDraft = z.object({
  title: z.string().min(1).max(80).describe('A short plain name for the idea'),
  lenses: z.array(z.object({ framework: z.number().int().describe('The n of the [n] framework used'), ...lensBody })).min(1).max(MAX_LENSES),
  bottom_line: z.string().min(1).max(500).describe('What the frameworks say taken together, including where they disagree'),
  next_steps: z.array(z.string().min(1).max(240)).min(2).max(4).describe('Concrete things to do this week, most useful first'),
});

export type RunDraft = z.infer<typeof runDraft>;

/** `playbook_runs.content`. Each lens keeps the framework's name, so it still reads if the framework is removed. */
export const run = runDraft.extend({
  lenses: z.array(z.object({ frameworkId: z.string(), name: z.string(), ...lensBody })).min(1).max(MAX_LENSES),
});

export type RunContent = z.infer<typeof run>;

export interface Run extends RunContent {
  id: string;
  idea: string;
  createdAt: string;
}

export interface RunSummary {
  id: string;
  title: string;
  idea: string;
  frameworks: string[];
  createdAt: string;
}

export const runRequest = z.object({
  idea: z.string().max(IDEA_MAX * 2),
  /** Use exactly these instead of letting the app pick. */
  frameworkIds: z.array(z.uuid()).max(MAX_LENSES).optional(),
});
