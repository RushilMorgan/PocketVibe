import 'server-only';
import { NonRetriableError } from 'inngest';
import { numberSources, researchText } from '@/lib/council/format';
import { MEMBER_SEATS, type MemberSeat } from '@/lib/council/roster';
import * as council from '@/lib/council/run';
import type { FollowupAnswer, FollowupTake, MemberVote, Report } from '@/lib/council/schemas';
import { setStatus } from '@/lib/council/service';
import { notifyUser } from '@/lib/notify';
import { getPromptContext } from '@/lib/profile';
import type { CouncilTurnRow } from '@/lib/supabase/database.types';
import { adminClient } from '@/lib/supabase/server';
import { inngest, councilFollowupQueued } from './client';

/** Earlier follow-ups the members see, newest last. */
const HISTORY_ROUNDS = 4;

/**
 * A follow-up on a finished report: fresh web research on the question →
 * every member answers in parallel → the chair consolidates → a quick vote.
 * The report itself stays as ratified; a changed verdict shows on the answer.
 */
export const councilFollowup = inngest.createFunction(
  {
    id: 'council-followup',
    triggers: [councilFollowupQueued],
    retries: 2,
    concurrency: { key: 'event.data.sessionId', limit: 1 },
    onFailure: async ({ event }) => {
      const { sessionId, userId } = event.data.event.data as { sessionId: string; userId: string };
      // The report is still there, so the session stays "done" with a note.
      await setStatus(userId, sessionId, { status: 'done', stage: 'done', error: "That follow-up didn't get an answer — try asking again." });
    },
  },
  async ({ event, step }) => {
    const { sessionId, userId, round, question } = event.data;
    const ctx: council.RunCtx = { sessionId, userId, round };

    const context = await step.run('start', async () => {
      const db = adminClient();
      const { data, error } = await db
        .from('council_sessions')
        .update({ status: 'running', stage: 'followup', error: null })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select('report')
        .single();
      if (error) throw error;
      if (!data.report) throw new NonRetriableError('The council has no report to follow up on.');
      const { data: earlier, error: turnsError } = await db
        .from('council_turns')
        .select('round, stage, member, content')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .gt('round', Math.max(0, round - 1 - HISTORY_ROUNDS))
        .lt('round', round)
        .in('stage', ['question', 'answer'])
        .order('round');
      if (turnsError) throw turnsError;
      const history = (earlier ?? [])
        .filter((t) => t.member === 'you' || t.member === 'chair')
        .map((t) =>
          t.member === 'you'
            ? `Q: ${(t.content as { question: string }).question}`
            : `A: ${(t.content as unknown as FollowupAnswer).answer}`,
        )
        .join('\n');
      const report = data.report as unknown as Report;
      return { report, reportText: council.reportText(report), history };
    });
    const pc = await step.run('context', () => getPromptContext(userId));

    const brief = await step.run('research', () => council.followupResearch(ctx, context.report, question));
    const sources = numberSources(brief ? [brief.citations] : []);
    const body = [
      `## The council's report\n${context.reportText}`,
      context.history ? `## Earlier follow-ups\n${context.history}` : '',
      `## Fresh research\n${researchText(brief ? [brief.brief] : [], sources)}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const answers = Object.fromEntries(
      (
        await Promise.all(
          MEMBER_SEATS.map((seat) =>
            step.run(`answer-${seat}`, () => council.followupTake(ctx, seat, body, question)).then(
              (a) => [seat, a] as const,
              (err) => {
                console.error('council follow-up: member dropped', seat, err);
                return null;
              },
            ),
          ),
        )
      ).filter((r) => r !== null),
    ) as Partial<Record<MemberSeat, FollowupTake>>;
    if (!Object.keys(answers).length) throw new NonRetriableError('No council member could answer — try again in a while.');

    const answer = await step.run('answer-chair', () => council.followupAnswer(ctx, pc, body, question, answers));

    const votes = (
      await Promise.all(
        (Object.keys(answers) as MemberSeat[]).map((seat) =>
          step.run(`ratify-${seat}`, () => council.followupVote(ctx, seat, body, question, answer)).catch((err) => {
            console.error('council follow-up: vote dropped', seat, err);
            return null;
          }),
        ),
      )
    ).filter((v): v is MemberVote => v !== null);

    // The numbered sources the answers cite, saved as their own turn for the page.
    await step.run('finish', async () => {
      const { error } = await adminClient()
        .from('council_turns')
        .upsert(
          { session_id: sessionId, user_id: userId, round, stage: 'sources', member: 'chair', model: '', content: { sources } as unknown as CouncilTurnRow['content'] },
          { onConflict: 'session_id,round,stage,member' },
        );
      if (error) throw error;
      await setStatus(userId, sessionId, { status: 'done', stage: 'done' });
    });
    await step.run('notify', () =>
      notifyUser(userId, { title: 'The council answered 🏛️', body: question.slice(0, 120), url: `/council/${sessionId}` }),
    );
    return { sessionId, round, members: Object.keys(answers).length, votes: votes.length };
  },
);
