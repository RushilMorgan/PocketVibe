import { z } from 'zod';
import type { Seat } from './roster';

/**
 * What each Council stage returns. Client-safe: the session page renders
 * these, and the job validates every model reply against them.
 */

export const VERDICTS = ['go', 'refine', 'park', 'drop'] as const;
export type Verdict = (typeof VERDICTS)[number];

/**
 * What was brought to the council (the chair decides when framing). The four
 * verdict values are the same scale in every mode, from "yes" to "no"; the
 * mode sets what they mean and how they're worded.
 */
export const MODES = ['decision', 'claim', 'question'] as const;
export type Mode = (typeof MODES)[number];

export const VERDICT_LABELS: Record<Mode, Record<Verdict, string>> = {
  /** An idea, plan or choice to act on. */
  decision: { go: 'Go', refine: 'Refine first', park: 'Park it', drop: 'Drop it' },
  /** Is this true? Does it hold up? */
  claim: { go: 'Holds up', refine: 'Partly true', park: 'Unproven', drop: "Doesn't hold up" },
  /** What's the answer? Which is better? What should I make of this? */
  question: { go: 'Clear answer', refine: 'Likely, with caveats', park: 'It depends', drop: "Can't say yet" },
};

/** Sessions from before modes have none: they were all ideas. */
export function verdictLabel(verdict: Verdict, mode?: Mode | null): string {
  return VERDICT_LABELS[mode ?? 'decision'][verdict];
}

export const VERDICT_LABEL = VERDICT_LABELS.decision;

/** How the report's steps are headed, and what each step's "kill signal" is called. */
export const STEPS_LABEL: Record<Mode, { heading: string; signal: string }> = {
  decision: { heading: 'Next steps', signal: 'Stop if: ' },
  claim: { heading: 'How to check it', signal: 'It would be wrong if: ' },
  question: { heading: 'What to do with this', signal: 'Think again if: ' },
};

const confidence = z.number().int().min(1).max(5);
const line = z.string().trim().min(1).max(600);

/** Chair, stage 1: what was brought, and what does weighing it up need? */
export const frameSchema = z.object({
  mode: z.enum(MODES),
  title: z.string().trim().min(1).max(80),
  kind: z.string().trim().min(1).max(40),
  restated: z.string().trim().min(1).max(1200),
  assumptions: z.array(line).min(2).max(8),
  sections: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
        heading: z.string().trim().min(1).max(60),
        focus: line,
      }),
    )
    .min(2)
    .max(6),
  questions: z.array(line).min(2).max(6),
});
export type Frame = z.infer<typeof frameSchema>;

/** A web researcher's brief; sources come from the gateway, not this text. */
export interface Research {
  brief: string;
}

/** Stage 3: one member's independent view. */
export const takeSchema = z.object({
  stance: z.enum(VERDICTS),
  confidence,
  summary: z.string().trim().min(1).max(1200),
  sections: z.array(z.object({ key: z.string(), points: z.array(line).max(6) })).max(6),
  strengths: z.array(line).max(6),
  risks: z
    .array(z.object({ risk: line, severity: z.enum(['high', 'medium', 'low']), test: line }))
    .max(8),
  next_steps: z.array(line).max(6),
});
export type Take = z.infer<typeof takeSchema>;

/** Stage 4: responding to the others (anonymised as letters). */
export const rebuttalSchema = z.object({
  challenges: z.array(z.object({ member: z.string().max(2), point: line, why: line })).max(6),
  concessions: z.array(line).max(6),
  changed_mind: z.string().trim().max(800),
  stance: z.enum(VERDICTS),
  confidence,
});
export type Rebuttal = z.infer<typeof rebuttalSchema>;

/** Stage 5 (and revision): the chair's report, in the sections the frame chose. */
export const draftSchema = z.object({
  verdict: z.enum(VERDICTS),
  confidence,
  headline: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(2000),
  sections: z
    .array(z.object({ key: z.string(), heading: z.string().max(60), points: z.array(line).min(1).max(8) }))
    .min(1)
    .max(6),
  disagreements: z.array(z.object({ topic: z.string().trim().min(1).max(120), sides: line })).max(5),
  next_steps: z
    .array(
      z.object({
        step: line,
        why: line,
        effort: z.enum(['hours', 'days', 'weeks']),
        kill_signal: line,
      }),
    )
    .min(1)
    .max(7),
});
export type Draft = z.infer<typeof draftSchema>;

export const VOTES = ['agree', 'agree_with_changes', 'dissent'] as const;
export type VoteChoice = (typeof VOTES)[number];

/** Stage 6: each member ratifies (or not) the chair's draft. */
export const voteSchema = z.object({
  vote: z.enum(VOTES),
  notes: z.string().trim().max(800),
  changes: z.array(line).max(5),
});
export type Vote = z.infer<typeof voteSchema>;

/** Follow-ups: each member's short answer, then the chair's consolidated one. */
export const followupTakeSchema = z.object({
  answer: z.string().trim().min(1).max(2000),
  points: z.array(line).max(6),
});
export type FollowupTake = z.infer<typeof followupTakeSchema>;

export const followupAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(3000),
  points: z.array(line).max(8),
  /** Set only when the follow-up genuinely moves the verdict. */
  new_verdict: z.enum(VERDICTS).nullable(),
});
export type FollowupAnswer = z.infer<typeof followupAnswerSchema>;

export interface Source {
  n: number;
  url: string;
  title: string;
}

export interface MemberVote extends Vote {
  member: string;
}

/** What the session page shows: the ratified draft plus how it got there. */
export interface Report extends Draft {
  title: string;
  kind: string;
  /** Missing on reports from before modes (all ideas). */
  mode?: Mode;
  sources: Source[];
  votes: MemberVote[];
  /** True when the first draft was sent back and rewritten. */
  revised: boolean;
}

export type SessionStatus = 'queued' | 'running' | 'done' | 'failed';

export const STAGES = ['frame', 'research', 'takes', 'debate', 'synthesis', 'ratify', 'followup', 'done'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  frame: 'Framing it',
  research: 'Researching the web',
  takes: 'Members forming views',
  debate: 'Cross-examining each other',
  synthesis: 'Chair drafting the report',
  ratify: 'Council voting on the verdict',
  followup: 'Answering your follow-up',
  done: 'Done',
};

/** Anything typed on the Council tab, or one of your saves with an optional question about it. */
export const newSessionRequest = z.union([
  z.object({ idea: z.string().trim().min(10).max(6000) }),
  z.object({ itemId: z.uuid(), question: z.string().trim().max(600).optional() }),
]);
export const followupRequest = z.object({ question: z.string().trim().min(2).max(2000) });

// ── API responses ───────────────────────────────────────────────────────────

export interface CouncilSummary {
  id: string;
  title: string | null;
  idea: string;
  status: SessionStatus;
  stage: string;
  verdict: Verdict | null;
  mode: Mode | null;
  headline: string | null;
  createdAt: string;
}

export interface CouncilTurn {
  round: number;
  stage: string;
  member: Seat | 'you';
  model: string;
  content: unknown;
  createdAt: string;
}

export interface CouncilSessionView {
  id: string;
  idea: string;
  title: string | null;
  status: SessionStatus;
  stage: string;
  error: string | null;
  report: Report | null;
  /** The save this session is about, if it was referred from one. */
  item: { id: string; title: string | null } | null;
  createdAt: string;
  costUsd: number;
  seats: { seat: Seat; label: string; model: string }[];
  turns: CouncilTurn[];
}
