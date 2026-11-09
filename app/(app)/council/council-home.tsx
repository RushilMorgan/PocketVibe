'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/components/api';
import { timeAgo } from '@/components/time-ago';
import { STAGE_LABEL, type CouncilSummary, type Stage } from '@/lib/council/schemas';
import { VerdictBadge } from './verdict';

const POLL_MS = 5000;

/** The Council tab: put an idea to it, and the sessions so far. */
export function CouncilHome() {
  const router = useRouter();
  const [sessions, setSessions] = useState<CouncilSummary[] | null>(null);
  const [idea, setIdea] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api<{ sessions: CouncilSummary[] }>('/api/council');
    setSessions(res.sessions);
  }, []);

  useEffect(() => {
    load().catch(() => setSessions([]));
  }, [load]);

  const working = sessions?.some((s) => s.status === 'queued' || s.status === 'running');
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => load().catch(() => {}), POLL_MS);
    return () => clearInterval(timer);
  }, [working, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const { id } = await api<{ id: string }>('/api/council', { body: { idea } });
      router.push(`/council/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Council</h1>
      <p className="mt-1 text-sm text-muted">
        Five AI models from different labs research your idea, argue about it, and agree a verdict and next steps.
      </p>

      <form onSubmit={submit} className="mt-5">
        <textarea
          required
          minLength={10}
          rows={5}
          placeholder="Describe the idea — what it is, who it's for, anything you already know."
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Takes a few minutes · roughly $1–2 a session</p>
          <button
            disabled={sending || idea.trim().length < 10}
            className="shrink-0 rounded-xl bg-accent px-4 py-2.5 font-medium text-on-accent disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Convene'}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <ul className="mt-8 flex flex-col gap-2">
        {sessions === null && <li className="text-muted">Loading…</li>}
        {sessions?.map((s) => (
          <li key={s.id}>
            <SessionCard session={s} />
          </li>
        ))}
        {sessions?.length === 0 && (
          <li className="rounded-xl border border-dashed border-line p-6 text-center text-muted">
            No ideas yet. Try a business idea, an app feature, or a decision you&apos;re stuck on.
          </li>
        )}
      </ul>
    </div>
  );
}

function SessionCard({ session: s }: { session: CouncilSummary }) {
  const working = s.status === 'queued' || s.status === 'running';
  return (
    <Link href={`/council/${s.id}`} className="block rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{working ? `${STAGE_LABEL[s.stage as Stage] ?? 'Working'}…` : s.status === 'failed' ? 'Stopped' : '🏛️'}</span>
        <span>{timeAgo(s.createdAt)}</span>
      </div>
      <p className="mt-1.5 font-medium leading-snug">{s.title ?? s.idea.slice(0, 90)}</p>
      {s.verdict && (
        <div className="mt-2 flex flex-col items-start gap-1.5">
          <VerdictBadge verdict={s.verdict} />
          {s.headline && <p className="line-clamp-2 text-sm text-muted">{s.headline}</p>}
        </div>
      )}
      {s.status === 'failed' && !s.verdict && <p className="mt-1 text-sm text-danger">Got stuck — tap to retry</p>}
    </Link>
  );
}
