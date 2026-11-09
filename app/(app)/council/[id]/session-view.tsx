'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from '@/components/api';
import { tally } from '@/lib/council/format';
import type { Seat } from '@/lib/council/roster';
import {
  STAGE_LABEL,
  VERDICT_LABEL,
  type CouncilSessionView,
  type CouncilTurn,
  type FollowupAnswer,
  type FollowupTake,
  type MemberVote,
  type Rebuttal,
  type Report,
  type Source,
  type Stage,
  type Take,
  type Vote,
} from '@/lib/council/schemas';
import { VerdictBadge } from '../verdict';

const POLL_MS = 3000;
const PROGRESS: Stage[] = ['frame', 'research', 'takes', 'debate', 'synthesis', 'ratify'];
const VOTE_LABEL: Record<Vote['vote'], string> = { agree: 'Agrees', agree_with_changes: 'Agrees, with changes', dissent: 'Dissents' };

type Seats = CouncilSessionView['seats'];

/** One idea before the Council: live progress, then the ratified report, the debate, and follow-ups. */
export function SessionView({ id }: { id: string }) {
  const [session, setSession] = useState<CouncilSessionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSession((await api<{ session: CouncilSessionView }>(`/api/council/${id}`)).session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const working = session?.status === 'queued' || session?.status === 'running';
  useEffect(() => {
    if (!working || error) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [working, error, load]);

  if (error) {
    return (
      <div>
        <BackLink />
        <p className="mt-6 text-danger">{error}</p>
      </div>
    );
  }
  if (!session) {
    return (
      <div>
        <BackLink />
        <p className="mt-6 text-muted">Loading…</p>
      </div>
    );
  }

  const first = session.turns.filter((t) => t.round === 0);
  const rounds = [...new Set(session.turns.filter((t) => t.round > 0).map((t) => t.round))];

  return (
    <div>
      <BackLink />
      <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
        {session.report && <p className="text-xs text-muted">{session.report.kind}</p>}
        <h1 className="mt-1 text-xl font-semibold leading-snug">{session.title ?? 'New idea'}</h1>
        <details className="mt-2 text-sm text-muted">
          <summary className="cursor-pointer">Your idea</summary>
          <p className="mt-2 whitespace-pre-wrap">{session.idea}</p>
        </details>

        {!session.report && working && <Progress session={session} />}
        {!session.report && session.status === 'failed' && <Failed session={session} onRetry={load} />}
        {session.report && <ReportView report={session.report} seats={session.seats} />}
      </div>

      {first.length > 0 && <Transcript turns={first} seats={session.seats} />}

      {rounds.map((round) => (
        <FollowupRound
          key={round}
          turns={session.turns.filter((t) => t.round === round)}
          seats={session.seats}
          working={working && round === rounds.at(-1)}
        />
      ))}

      {session.report && (
        <>
          {session.status === 'done' && session.error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{session.error}</p>}
          <FollowupForm id={id} busy={working} onSent={load} />
        </>
      )}

      {session.costUsd > 0 && <p className="mt-6 text-center text-xs text-muted">Cost so far ${session.costUsd.toFixed(2)}</p>}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/council" className="text-sm text-muted">
      ← All ideas
    </Link>
  );
}

function seatLabel(seats: Seats, seat: string): string {
  return seats.find((s) => s.seat === seat)?.label ?? seat;
}

/** "anthropic/claude-opus-5.5" → "claude-opus-5.5" */
function modelName(model: string): string {
  return model.split('/').pop() ?? model;
}

// ── Progress & failure ───────────────────────────────────────────────────────

function Progress({ session }: { session: CouncilSessionView }) {
  const current = PROGRESS.indexOf(session.stage as Stage);
  const done = (stage: string, seat: string) => session.turns.some((t) => t.round === 0 && t.stage === stage && t.member === seat);
  return (
    <div className="mt-5">
      <p className="text-lg font-medium">The council is deliberating…</p>
      <p className="mt-1 text-sm text-muted">Usually 3–6 minutes. You&apos;ll get a notification if they&apos;re on.</p>
      <ol className="mt-4 flex flex-col gap-2">
        {PROGRESS.map((stage, i) => (
          <li key={stage} className={`flex items-center gap-2 text-sm ${i > current ? 'text-muted' : ''}`}>
            <span aria-hidden className="w-5 text-center">
              {i < current ? '✓' : i === current ? '◐' : '·'}
            </span>
            <span className={i === current ? 'font-medium' : ''}>{STAGE_LABEL[stage]}</span>
          </li>
        ))}
      </ol>
      <ul className="mt-5 flex flex-wrap gap-1.5">
        {session.seats.map((s) => {
          const stage = session.stage === 'takes' ? 'take' : session.stage === 'debate' ? 'rebut' : session.stage === 'ratify' ? 'ratify' : null;
          const answered = stage && s.seat !== 'chair' && done(stage, s.seat);
          return (
            <li key={s.seat} className={`rounded-full border px-2.5 py-1 text-xs ${answered ? 'border-success text-success' : 'border-line text-muted'}`}>
              {s.label} · {modelName(s.model)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Failed({ session, onRetry }: { session: CouncilSessionView; onRetry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function retry() {
    setBusy(true);
    try {
      await api(`/api/council/${session.id}/retry`, { method: 'POST' });
      await onRetry();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5">
      <p className="text-lg font-medium">The council got stuck</p>
      {session.error && <p className="mt-1 text-sm text-muted">{session.error}</p>}
      <button onClick={retry} disabled={busy} className="mt-4 rounded-xl bg-accent px-4 py-2 font-medium text-on-accent disabled:opacity-60">
        Retry
      </button>
    </div>
  );
}

// ── Report ───────────────────────────────────────────────────────────────────

/** Text with [S3]-style citations turned into links to the real pages. */
function Cited({ text, sources }: { text: string; sources: Source[] }) {
  const parts = text.split(/(\[S\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const n = /^\[S(\d+)\]$/.exec(part)?.[1];
        const source = n ? sources.find((s) => s.n === Number(n)) : undefined;
        if (!source) return <Fragment key={i}>{n ? '' : part}</Fragment>;
        return (
          <a key={i} href={source.url} target="_blank" rel="noreferrer" title={source.title} className="align-super text-[0.7em] text-accent">
            [{source.n}]
          </a>
        );
      })}
    </>
  );
}

function ReportView({ report, seats }: { report: Report; seats: Seats }) {
  const t = tally(report.votes);
  return (
    <article className="mt-5">
      <VerdictBadge verdict={report.verdict} confidence={report.confidence} />
      <p className="mt-3 text-lg font-medium leading-snug">{report.headline}</p>
      <p className="mt-2">
        <Cited text={report.summary} sources={report.sources} />
      </p>

      {report.sections.map((s) => (
        <section key={s.key} className="mt-5">
          <h2 className="font-semibold">{s.heading}</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
            {s.points.map((p, i) => (
              <li key={i}>
                <Cited text={p} sources={report.sources} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {report.disagreements.length > 0 && (
        <section className="mt-5">
          <h2 className="font-semibold">Where they still disagree</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {report.disagreements.map((d, i) => (
              <li key={i} className="rounded-lg bg-bg p-3 text-sm">
                <span className="font-medium">{d.topic}: </span>
                {d.sides}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5">
        <h2 className="font-semibold">Next steps</h2>
        <ol className="mt-2 flex flex-col divide-y divide-line rounded-xl border border-line">
          {report.next_steps.map((s, i) => (
            <li key={i} className="flex gap-3 px-3 py-3">
              <span aria-hidden className="w-5 shrink-0 pt-0.5 text-right text-sm text-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{s.step}</span>
                  <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">{s.effort}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{s.why}</p>
                <p className="mt-1 text-sm">
                  <span className="font-medium">Stop if: </span>
                  {s.kill_signal}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-5">
        <h2 className="font-semibold">
          {t.dissent === 0 ? 'Ratified' : 'Ratified with dissent'} · {t.agree + t.agree_with_changes}/{report.votes.length} sign
          {report.revised && <span className="font-normal text-muted"> · revised once</span>}
        </h2>
        <ul className="mt-2 flex flex-col gap-2">
          {report.votes.map((v) => (
            <VoteRow key={v.member} vote={v} seats={seats} />
          ))}
        </ul>
      </section>

      {report.sources.length > 0 && (
        <section className="mt-5">
          <h2 className="font-semibold">Sources</h2>
          <SourceList sources={report.sources} />
        </section>
      )}
    </article>
  );
}

function VoteRow({ vote, seats }: { vote: MemberVote; seats: Seats }) {
  const tone = vote.vote === 'agree' ? 'text-success' : vote.vote === 'dissent' ? 'text-danger' : 'text-accent';
  return (
    <li className="text-sm">
      <span className="font-medium">{seatLabel(seats, vote.member)}</span> <span className={tone}>{VOTE_LABEL[vote.vote]}</span>
      {vote.notes && <span className="text-muted"> — {vote.notes}</span>}
    </li>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  return (
    <ol className="mt-2 flex flex-col gap-1.5 text-sm">
      {sources.map((s) => (
        <li key={s.n} className="flex gap-2">
          <span className="w-5 shrink-0 text-right text-muted">{s.n}</span>
          <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-accent">
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

// ── How they got there ───────────────────────────────────────────────────────

function Transcript({ turns, seats }: { turns: CouncilTurn[]; seats: Seats }) {
  const of = (stage: string) => turns.filter((t) => t.stage === stage && t.member !== 'chair');
  const takes = of('take');
  const rebuttals = of('rebut');
  const research = of('research');
  if (!takes.length && !research.length) return null;
  return (
    <details className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <summary className="cursor-pointer font-semibold">How they got there</summary>

      {research.length > 0 && (
        <TranscriptSection title="Research">
          {research.map((t) => (
            <Member key={t.member} turn={t} seats={seats}>
              <p className="whitespace-pre-wrap">{(t.content as { brief: string }).brief}</p>
            </Member>
          ))}
        </TranscriptSection>
      )}

      {takes.length > 0 && (
        <TranscriptSection title="First views">
          {takes.map((t) => {
            const take = t.content as Take;
            return (
              <Member key={t.member} turn={t} seats={seats}>
                <VerdictBadge verdict={take.stance} confidence={take.confidence} />
                <p className="mt-2">{take.summary}</p>
                {take.risks.length > 0 && (
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted">
                    {take.risks.map((r, i) => (
                      <li key={i}>
                        <span className="font-medium">{r.severity} risk:</span> {r.risk}
                      </li>
                    ))}
                  </ul>
                )}
              </Member>
            );
          })}
        </TranscriptSection>
      )}

      {rebuttals.length > 0 && (
        <TranscriptSection title="Cross-examination">
          {rebuttals.map((t) => {
            const r = t.content as Rebuttal;
            return (
              <Member key={t.member} turn={t} seats={seats}>
                <p>
                  Now: <span className="font-medium">{VERDICT_LABEL[r.stance]}</span>
                  {r.changed_mind && <span className="text-muted"> — {r.changed_mind}</span>}
                </p>
                {r.challenges.length > 0 && (
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted">
                    {r.challenges.map((c, i) => (
                      <li key={i}>
                        {c.point} — {c.why}
                      </li>
                    ))}
                  </ul>
                )}
              </Member>
            );
          })}
        </TranscriptSection>
      )}
    </details>
  );
}

function TranscriptSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">{title}</h3>
      <div className="mt-2 flex flex-col divide-y divide-line">{children}</div>
    </section>
  );
}

function Member({ turn, seats, children }: { turn: CouncilTurn; seats: Seats; children: React.ReactNode }) {
  return (
    <div className="py-3 text-sm">
      <p className="mb-1.5 text-xs text-muted">
        <span className="font-semibold text-ink">{seatLabel(seats, turn.member)}</span> · {modelName(turn.model)}
      </p>
      {children}
    </div>
  );
}

// ── Follow-ups ───────────────────────────────────────────────────────────────

function FollowupRound({ turns, seats, working }: { turns: CouncilTurn[]; seats: Seats; working: boolean }) {
  const question = (turns.find((t) => t.stage === 'question')?.content as { question: string } | undefined)?.question;
  const answer = turns.find((t) => t.stage === 'answer' && t.member === 'chair')?.content as FollowupAnswer | undefined;
  const sources = (turns.find((t) => t.stage === 'sources')?.content as { sources: Source[] } | undefined)?.sources ?? [];
  const members = turns.filter((t) => t.stage === 'answer' && t.member !== 'chair');
  const votes = turns
    .filter((t) => t.stage === 'ratify')
    .map((t): MemberVote => ({ ...(t.content as Vote), member: t.member as Seat }));
  return (
    <section className="mt-6">
      {question && <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-accent px-4 py-2.5 text-on-accent">{question}</p>}
      <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
        {!answer && <p className="text-muted">{working ? 'The council is talking it over…' : 'No answer came back — try asking again.'}</p>}
        {answer && (
          <>
            {answer.new_verdict && (
              <p className="mb-3 text-sm">
                Verdict now: <VerdictBadge verdict={answer.new_verdict} />
              </p>
            )}
            <p className="whitespace-pre-wrap">
              <Cited text={answer.answer} sources={sources} />
            </p>
            {answer.points.length > 0 && (
              <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5">
                {answer.points.map((p, i) => (
                  <li key={i}>
                    <Cited text={p} sources={sources} />
                  </li>
                ))}
              </ul>
            )}
            {votes.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1.5">
                {votes.map((v) => (
                  <VoteRow key={v.member} vote={v} seats={seats} />
                ))}
              </ul>
            )}
            {members.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted">Each member&apos;s answer</summary>
                <div className="mt-2 flex flex-col divide-y divide-line">
                  {members.map((t) => (
                    <Member key={t.member} turn={t} seats={seats}>
                      <p>
                        <Cited text={(t.content as FollowupTake).answer} sources={sources} />
                      </p>
                    </Member>
                  ))}
                </div>
              </details>
            )}
            {sources.length > 0 && <SourceList sources={sources} />}
          </>
        )}
      </div>
    </section>
  );
}

function FollowupForm({ id, busy, onSent }: { id: string; busy: boolean; onSent: () => Promise<void> }) {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api(`/api/council/${id}/followups`, { body: { question } });
      setQuestion('');
      await onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this idea and everything the council said about it?')) return;
    await api(`/api/council/${id}`, { method: 'DELETE' });
    router.push('/council');
  }

  return (
    <div className="mt-6">
      <form onSubmit={send} className="flex gap-2">
        <input
          required
          minLength={2}
          placeholder={busy ? 'The council is working…' : 'Ask a follow-up, or "go deeper on…"'}
          value={question}
          disabled={busy}
          onChange={(e) => setQuestion(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent disabled:opacity-60"
        />
        <button disabled={busy || sending || question.trim().length < 2} className="rounded-xl bg-accent px-4 py-3 font-medium text-on-accent disabled:opacity-60">
          Ask
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button onClick={remove} className="mt-6 text-sm text-muted underline">
        Delete this idea
      </button>
    </div>
  );
}
