import 'server-only';
import type { z } from 'zod';
import { orJson, orText, type Citation, type Effort, type OrResult } from '@/lib/ai/openrouter';
import { prompt, type PromptName } from '@/lib/ai/prompts';
import { councilEnv } from '@/lib/env';
import type { PromptContext } from '@/lib/profile';
import type { CouncilTurnRow } from '@/lib/supabase/database.types';
import { adminClient } from '@/lib/supabase/server';
import {
  debateText,
  draftText,
  frameText,
  othersText,
  rebuttalText,
  takeText,
  votesText,
} from './format';
import { LETTER, rosterFrom, type MemberSeat, type Seat, type SeatInfo } from './roster';
import {
  draftSchema,
  followupAnswerSchema,
  followupTakeSchema,
  frameSchema,
  rebuttalSchema,
  takeSchema,
  voteSchema,
  type Draft,
  type FollowupAnswer,
  type FollowupTake,
  type Frame,
  type MemberVote,
  type Rebuttal,
  type Report,
  type Take,
  type Vote,
} from './schemas';

/**
 * One function per Council stage. Each model reply is saved as a turn before
 * it's returned, and an existing turn is returned instead of calling the model
 * again — so a retried job (or Retry after a failure) only pays for the
 * stages that didn't finish.
 */

export interface RunCtx {
  sessionId: string;
  userId: string;
  round: number;
}

export interface ResearchOut {
  brief: string;
  citations: Citation[];
}

export function roster(): Record<Seat, SeatInfo> {
  return rosterFrom(councilEnv().COUNCIL_MODELS);
}

async function turn<T>(ctx: RunCtx, stage: string, seat: Seat, run: (model: string) => Promise<OrResult<T>>): Promise<T> {
  const db = adminClient();
  const { data: existing, error } = await db
    .from('council_turns')
    .select('content')
    .eq('session_id', ctx.sessionId)
    .eq('user_id', ctx.userId)
    .eq('round', ctx.round)
    .eq('stage', stage)
    .eq('member', seat)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.content as T;

  const model = roster()[seat].model;
  const out = await run(model);
  const { error: saveError } = await db.from('council_turns').upsert(
    {
      session_id: ctx.sessionId,
      user_id: ctx.userId,
      round: ctx.round,
      stage,
      member: seat,
      model,
      content: out.data as CouncilTurnRow['content'],
      cost_usd: out.cost,
    },
    { onConflict: 'session_id,round,stage,member' },
  );
  if (saveError) throw saveError;
  return out.data;
}

/** A structured call for one seat with its stage prompt as the system message. */
async function ask<T>(
  ctx: RunCtx,
  stage: string,
  seat: Seat,
  promptName: PromptName,
  schema: z.ZodType<T>,
  user: string,
  opts: { vars?: Record<string, string>; effort?: Effort } = {},
): Promise<T> {
  return turn(ctx, stage, seat, async (model) => {
    const system = await prompt(promptName, { ...seatVars(seat), ...opts.vars });
    return orJson(schema, stage.replace(/\W/g, '_'), { model, system, user, effort: opts.effort });
  });
}

function seatVars(seat: Seat): Record<string, string> {
  return { lens: roster()[seat].lens, letter: seat === 'chair' ? '' : LETTER[seat] };
}

const section = (title: string, body: string) => `## ${title}\n${body}`;

// ── Round 0 ──────────────────────────────────────────────────────────────────

export function frame(ctx: RunCtx, idea: string): Promise<Frame> {
  return ask(ctx, 'frame', 'chair', 'council-frame', frameSchema, section('The idea', idea), { effort: 'medium' });
}

/** Web research on some of the questions. Null if the search fails: members then work without it. */
export async function research(ctx: RunCtx, seat: MemberSeat, idea: string, questions: string[]): Promise<ResearchOut | null> {
  try {
    return await turn(ctx, 'research', seat, async (model) => {
      const out = await orText({
        model,
        system: await prompt('council-research', seatVars(seat)),
        user: [section('The idea', idea), section('Research questions', questions.map((q) => `- ${q}`).join('\n'))].join('\n\n'),
        effort: 'low',
        web: true,
      });
      return { ...out, data: { brief: out.data, citations: out.citations } };
    });
  } catch (err) {
    console.error('council: research failed, continuing without it', seat, err);
    return null;
  }
}

export function take(ctx: RunCtx, seat: MemberSeat, f: Frame, researchBody: string): Promise<Take> {
  return ask(ctx, 'take', seat, 'council-take', takeSchema, [section('Framed idea', frameText(f)), section('Research', researchBody)].join('\n\n'));
}

export function rebut(ctx: RunCtx, seat: MemberSeat, f: Frame, takes: Partial<Record<MemberSeat, Take>>): Promise<Rebuttal> {
  return ask(
    ctx,
    'rebut',
    seat,
    'council-rebut',
    rebuttalSchema,
    [section('Framed idea', frameText(f)), section('Your view', takeText(takes[seat]!)), section('The other members', othersText(takes, seat))].join('\n\n'),
    { effort: 'low' },
  );
}

export function synthesize(
  ctx: RunCtx,
  pc: PromptContext,
  f: Frame,
  researchBody: string,
  takes: Partial<Record<MemberSeat, Take>>,
  rebuttals: Partial<Record<MemberSeat, Rebuttal>>,
): Promise<Draft> {
  return ask(
    ctx,
    'synthesize',
    'chair',
    'council-synthesize',
    draftSchema,
    [section('Framed idea', frameText(f)), section('Research', researchBody), section('The debate', debateText(takes, rebuttals))].join('\n\n'),
    { vars: pc, effort: 'high' },
  );
}

/** `attempt` 1 votes on the first draft, 2 on the revision. */
export async function ratify(
  ctx: RunCtx,
  seat: MemberSeat,
  attempt: 1 | 2,
  f: Frame,
  ownView: string,
  draft: Draft,
): Promise<MemberVote> {
  const vote: Vote = await ask(
    ctx,
    attempt === 1 ? 'ratify' : 'ratify-2',
    seat,
    'council-ratify',
    voteSchema,
    [section('Framed idea', frameText(f)), section('Your final view', ownView), section('The draft report', draftText(draft))].join('\n\n'),
    { effort: 'low' },
  );
  return { ...vote, member: seat };
}

export function revise(ctx: RunCtx, pc: PromptContext, f: Frame, draft: Draft, votes: MemberVote[]): Promise<Draft> {
  return ask(
    ctx,
    'revise',
    'chair',
    'council-revise',
    draftSchema,
    [section('Framed idea', frameText(f)), section('Your draft', draftText(draft)), section('The votes', votesText(labelVotes(votes)))].join('\n\n'),
    { vars: pc, effort: 'medium' },
  );
}

/** A member's last word before voting: the rebuttal if they made one, else their take. */
export function finalView(take: Take, rebuttal: Rebuttal | undefined): string {
  return rebuttal ? `${takeText(take)}\n\nAfter debate:\n${rebuttalText(rebuttal)}` : takeText(take);
}

/** Votes as the chair reads them: by letter, like the debate. */
function labelVotes(votes: MemberVote[]): MemberVote[] {
  return votes.map((v) => ({ ...v, member: `Member ${LETTER[v.member as MemberSeat] ?? v.member}` }));
}

// ── Follow-ups ───────────────────────────────────────────────────────────────

export function reportText(report: Report): string {
  return `${report.title} (${report.kind})\n\n${draftText(report)}`;
}

export async function followupResearch(ctx: RunCtx, report: Report, question: string): Promise<ResearchOut | null> {
  return research(ctx, 'builder', `${report.title}: ${report.headline}`, [question]);
}

export function followupTake(ctx: RunCtx, seat: MemberSeat, context: string, question: string): Promise<FollowupTake> {
  return ask(ctx, 'answer', seat, 'council-followup', followupTakeSchema, [context, section('The question', question)].join('\n\n'), {
    effort: 'low',
  });
}

export function followupAnswer(
  ctx: RunCtx,
  pc: PromptContext,
  context: string,
  question: string,
  answers: Partial<Record<MemberSeat, FollowupTake>>,
): Promise<FollowupAnswer> {
  const members = (Object.entries(answers) as [MemberSeat, FollowupTake][])
    .map(([seat, a]) => `Member ${LETTER[seat]}:\n${a.answer}${a.points.map((p) => `\n- ${p}`).join('')}`)
    .join('\n\n');
  return ask(
    ctx,
    'answer',
    'chair',
    'council-followup-answer',
    followupAnswerSchema,
    [context, section('The question', question), section("Members' answers", members)].join('\n\n'),
    { vars: pc, effort: 'medium' },
  );
}

/** A quick yes/no on the chair's follow-up answer (no revision loop). */
export async function followupVote(ctx: RunCtx, seat: MemberSeat, context: string, question: string, a: FollowupAnswer): Promise<MemberVote> {
  const body = `${a.answer}${a.points.map((p) => `\n- ${p}`).join('')}${a.new_verdict ? `\n\nNew verdict: ${a.new_verdict}` : ''}`;
  const vote: Vote = await ask(
    ctx,
    'ratify',
    seat,
    'council-ratify',
    voteSchema,
    [context, section('The question', question), section("The chair's answer (vote on this, not the report)", body)].join('\n\n'),
    { effort: 'low' },
  );
  return { ...vote, member: seat };
}

