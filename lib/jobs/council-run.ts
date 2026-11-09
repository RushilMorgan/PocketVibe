import 'server-only';
import { NonRetriableError } from 'inngest';
import { needsRevision, numberSources, researchText, splitQuestions } from '@/lib/council/format';
import { MEMBER_SEATS, RESEARCHERS, type MemberSeat } from '@/lib/council/roster';
import * as council from '@/lib/council/run';
import type { MemberVote, Report, Stage } from '@/lib/council/schemas';
import { setStatus } from '@/lib/council/service';
import { notifyUser } from '@/lib/notify';
import { getPromptContext } from '@/lib/profile';
import type { CouncilSessionRow } from '@/lib/supabase/database.types';
import { adminClient } from '@/lib/supabase/server';
import { inngest, councilQueued } from './client';

/** Fewer members than this answering means the "council" is one or two voices: fail instead. */
const QUORUM = 3;

/**
 * An idea through the Council: frame → web research → independent takes →
 * cross-examination → chair's draft → vote (→ one revision + re-vote if
 * anyone objects) → report. Members run in parallel steps; a member whose
 * model keeps failing is left out rather than sinking the session.
 */
export const councilRun = inngest.createFunction(
  {
    id: 'council-run',
    triggers: [councilQueued],
    retries: 2,
    concurrency: { key: 'event.data.userId', limit: 2 },
    onFailure: async ({ event, error }) => {
      const { sessionId, userId } = event.data.event.data as { sessionId: string; userId: string };
      await setStatus(userId, sessionId, {
        status: 'failed',
        error: error.name === 'NonRetriableError' ? error.message : 'The council got stuck partway — tap Retry to pick up where it stopped.',
      });
    },
  },
  async ({ event, step }) => {
    const { sessionId, userId } = event.data;
    const ctx: council.RunCtx = { sessionId, userId, round: 0 };
    const stage = (name: Stage, fields: Partial<CouncilSessionRow> = {}) =>
      step.run(`stage-${name}`, () => setStatus(userId, sessionId, { stage: name, ...fields }));

    const idea = await step.run('start', async () => {
      const { data, error } = await adminClient()
        .from('council_sessions')
        .update({ status: 'running', error: null })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select('idea')
        .single();
      if (error) throw error;
      return data.idea;
    });
    const pc = await step.run('context', () => getPromptContext(userId));

    await stage('frame');
    const frame = await step.run('frame', () => council.frame(ctx, idea));

    await stage('research', { title: frame.title });
    const briefs = await Promise.all(
      splitQuestions(frame.questions, RESEARCHERS.length).map((questions, i) =>
        step.run(`research-${RESEARCHERS[i]}`, () => council.research(ctx, RESEARCHERS[i], frame.restated, questions)),
      ),
    );
    const found = briefs.filter((b) => b !== null);
    const sources = numberSources(found.map((b) => b.citations));
    const research = researchText(
      found.map((b) => b.brief),
      sources,
    );

    await stage('takes');
    const takes = await members(MEMBER_SEATS, (seat) => step.run(`take-${seat}`, () => council.take(ctx, seat, frame, research)));
    const seated = Object.keys(takes) as MemberSeat[];
    if (seated.length < QUORUM) {
      throw new NonRetriableError("Too few council members could answer — the AI providers may be down. Tap Retry in a while.");
    }

    await stage('debate');
    const rebuttals = await members(seated, (seat) => step.run(`rebut-${seat}`, () => council.rebut(ctx, seat, frame, takes)));

    await stage('synthesis');
    let draft = await step.run('synthesize', () => council.synthesize(ctx, pc, frame, research, takes, rebuttals));

    await stage('ratify');
    const views = Object.fromEntries(seated.map((s) => [s, council.finalView(takes[s]!, rebuttals[s])])) as Record<MemberSeat, string>;
    let votes = await vote(seated, (seat) => step.run(`ratify-${seat}`, () => council.ratify(ctx, seat, 1, frame, views[seat], draft)));
    let revised = false;
    if (needsRevision(votes)) {
      const firstVotes = votes;
      draft = await step.run('revise', () => council.revise(ctx, pc, frame, draft, firstVotes));
      const revisedDraft = draft;
      votes = await vote(seated, (seat) => step.run(`ratify-2-${seat}`, () => council.ratify(ctx, seat, 2, frame, views[seat], revisedDraft)));
      revised = true;
    }

    const report: Report = { ...draft, title: frame.title, kind: frame.kind, sources, votes, revised };
    await step.run('finish', () =>
      setStatus(userId, sessionId, { status: 'done', stage: 'done', report: report as unknown as CouncilSessionRow['report'] }),
    );
    await step.run('notify', () =>
      notifyUser(userId, { title: 'The council has a verdict 🏛️', body: `${frame.title}: ${draft.headline}`, url: `/council/${sessionId}` }),
    );
    return { sessionId, verdict: draft.verdict, revised, members: seated.length };
  },
);

/** Runs one step per seat in parallel; seats whose step gave up are dropped. */
async function members<T>(seats: MemberSeat[], run: (seat: MemberSeat) => Promise<T>): Promise<Partial<Record<MemberSeat, T>>> {
  const results = await Promise.all(
    seats.map((seat) =>
      run(seat).then(
        (value) => [seat, value] as const,
        (err) => {
          console.error('council: member dropped', seat, err);
          return null;
        },
      ),
    ),
  );
  return Object.fromEntries(results.filter((r) => r !== null));
}

async function vote(seats: MemberSeat[], run: (seat: MemberSeat) => Promise<MemberVote>): Promise<MemberVote[]> {
  return Object.values(await members(seats, run)).filter((v): v is MemberVote => Boolean(v));
}

