'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/components/api';
import { SectionLabel } from '@/components/explainer-card';
import { timeAgo } from '@/components/time-ago';
import type { Run } from '@/lib/playbook/schema';

/**
 * One idea worked through the playbook: what each framework shows, what they
 * add up to, and what to do next. From here it can go to the Council.
 */
export function RunView({ id }: { id: string }) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'council' | 'delete' | null>(null);

  useEffect(() => {
    api<{ run: Run }>(`/api/playbook/runs/${id}`).then(
      (r) => setRun(r.run),
      (err) => setError(err instanceof Error ? err.message : 'Something went wrong'),
    );
  }, [id]);

  async function debate() {
    setBusy('council');
    setError(null);
    try {
      const session = await api<{ id: string }>(`/api/playbook/runs/${id}/council`, { method: 'POST' });
      router.push(`/council/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm('Delete this? Your frameworks stay.')) return;
    setBusy('delete');
    try {
      await api(`/api/playbook/runs/${id}`, { method: 'DELETE' });
      router.push('/playbook');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(null);
    }
  }

  return (
    <div className="pb-6">
      <Link href="/playbook" className="text-sm text-muted">
        ← Playbook
      </Link>
      {error && <p className="mt-4 text-danger">{error}</p>}
      {!run && !error && <p className="mt-6 text-muted">Loading…</p>}
      {run && (
        <>
          <p className="mt-4 text-xs text-muted">Worked through {timeAgo(run.createdAt)}</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight">{run.title}</h1>
          <details className="mt-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-muted">What you wrote</summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{run.idea}</p>
          </details>

          <section className="mt-6 rounded-2xl border border-accent/25 bg-accent/10 p-4">
            <p className="text-sm font-bold text-accent">The bottom line</p>
            <p className="mt-1.5 leading-relaxed">{run.bottom_line}</p>
          </section>

          <section className="mt-7">
            <SectionLabel>Do next</SectionLabel>
            <ol className="mt-3 flex flex-col gap-2.5">
              {run.next_steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          {run.lenses.map((lens) => (
            <section key={lens.frameworkId} className="mt-7">
              <SectionLabel>Through {lens.name}</SectionLabel>
              <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm text-muted">{lens.why}</p>
                <dl className="mt-3 flex flex-col gap-3">
                  {lens.points.map((p, i) => (
                    <div key={i}>
                      <dt className="text-sm font-bold">{p.label}</dt>
                      <dd className="mt-0.5 text-sm leading-relaxed">{p.finding}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 rounded-xl border border-accent/25 bg-accent/10 p-3">
                  <p className="text-xs font-bold text-accent">What it shows</p>
                  <p className="mt-0.5 text-sm leading-relaxed">{lens.insight}</p>
                </div>
                {lens.unknowns.length > 0 && (
                  <div className="mt-2 rounded-xl border border-warm/30 bg-warm/10 p-3">
                    <p className="text-xs font-bold text-warm">Find out first</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {lens.unknowns.map((u, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-relaxed">
                          <span aria-hidden>•</span>
                          <span>{u}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          ))}

          <p className="mt-6 text-xs text-muted">
            Written by AI from your own words and these frameworks. It hasn&apos;t looked anything up, so treat numbers and market
            claims as things to check.
          </p>

          <section className="mt-6 rounded-3xl border border-line bg-surface p-4">
            <h2 className="flex items-center gap-2 font-bold">
              <span aria-hidden>🏛️</span> Stress-test it with the Council
            </h2>
            <p className="mt-1 text-sm text-muted">
              Five AI models research the idea on the web, argue it out and agree an answer. Takes a few minutes, roughly $1–2.
            </p>
            <button
              onClick={debate}
              disabled={busy !== null}
              className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-on-accent disabled:opacity-60"
            >
              {busy === 'council' ? 'Sending…' : 'Send to the council'}
            </button>
          </section>

          <button onClick={remove} disabled={busy !== null} className="mt-6 text-sm text-muted underline disabled:opacity-60">
            {busy === 'delete' ? 'Deleting…' : 'Delete this'}
          </button>
        </>
      )}
    </div>
  );
}
