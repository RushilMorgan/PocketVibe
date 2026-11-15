'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/components/api';
import { verdictLabel, type CouncilSummary } from '@/lib/council/schemas';

/**
 * Run this save by the Council: five models research it, argue it out and
 * agree an answer. Type what you want them to weigh in on, or leave it blank
 * for "what should I make of this?". Earlier sessions about the save are listed.
 */
export function CouncilCard({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<CouncilSummary[]>([]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ sessions: CouncilSummary[] }>(`/api/council?itemId=${itemId}`).then(
      (r) => setSessions(r.sessions),
      () => {},
    );
  }, [itemId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>('/api/council', { body: { itemId, question: question.trim() || undefined } });
      router.push(`/council/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSending(false);
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-line bg-surface p-4">
      <h2 className="flex items-center gap-2 font-bold">
        <span aria-hidden>🏛️</span> Run it by the Council
      </h2>
      <p className="mt-1 text-sm text-muted">Five AI models research this, argue it out and agree an answer. Takes a few minutes, roughly $1–2.</p>

      {sessions.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {sessions.map((s) => {
            const working = s.status === 'queued' || s.status === 'running';
            return (
              <li key={s.id}>
                <Link href={`/council/${s.id}`} className="flex items-center gap-3 rounded-xl bg-bg px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.headline ?? s.title ?? 'With the council'}</span>
                    <span className="block text-xs text-muted">
                      {working ? 'The council is working on it…' : s.verdict ? verdictLabel(s.verdict, s.mode) : s.status === 'failed' ? 'Got stuck. Tap to retry' : ''}
                    </span>
                  </span>
                  <span aria-hidden className="text-muted">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={send} className="mt-3 flex flex-col gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={600}
          rows={2}
          placeholder="What should they weigh in on? e.g. Is this true? Should I do this? (optional)"
          aria-label="Your question for the council"
          className="w-full resize-y rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button disabled={sending} className="rounded-xl bg-accent py-2.5 text-sm font-semibold text-on-accent disabled:opacity-60">
          {sending ? 'Sending…' : sessions.length ? 'Ask the council again' : 'Send to the council'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
