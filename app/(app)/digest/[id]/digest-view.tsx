'use client';

import { useEffect, useState } from 'react';
import { api } from '@/components/api';
import type { DigestContent } from '@/lib/digest/schema';

interface Digest {
  id: string;
  weekStart: string;
  content: DigestContent;
  links: Record<string, string>;
}

/**
 * The weekly digest in the app. Every link goes through the /d tracker, so a
 * tap here counts as a digest_open just like one from the push or email.
 */
export function DigestView({ id }: { id: string }) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ digest: Digest }>(`/api/digests/${id}`).then(
      (r) => setDigest(r.digest),
      (err) => setError(err instanceof Error ? err.message : 'Something went wrong'),
    );
  }, [id]);

  if (error) return <p className="text-danger">{error}</p>;
  if (!digest) return <p className="text-muted">Loading…</p>;

  const { content: d, links } = digest;
  const href = (to: string) => links[to] ?? to;

  return (
    <div>
      <p className="text-sm text-muted">
        {d.from} – {d.to}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Your week</h1>
      <p className="mt-1 text-sm text-muted">
        {d.stats.saved} saved{d.stats.played > 0 && ` · ${d.stats.played} lesson${d.stats.played === 1 ? '' : 's'} played`}
      </p>

      {d.whatif && (
        <a href={href(`/items/${d.whatif.itemId}?whatif=1`)} className="mt-6 block rounded-2xl bg-accent p-4 text-on-accent">
          <span className="text-sm opacity-80">🤔 What if… — from {d.whatif.itemTitle}</span>
          <span className="mt-1 block text-lg font-semibold leading-snug">{d.whatif.scenario}</span>
        </a>
      )}

      {d.lesson && (
        <a
          href={href(`/play/${d.lesson.lessonId}`)}
          className="mt-6 block rounded-2xl bg-accent p-4 text-on-accent"
        >
          <span className="text-sm opacity-80">2-minute lesson from something you haven&apos;t opened</span>
          <span className="mt-1 block text-lg font-semibold leading-snug">▶ {d.lesson.itemTitle}</span>
        </a>
      )}

      <Section title="What you saved">
        {d.groups.length === 0 && <p className="text-muted">Nothing saved this week.</p>}
        {d.groups.map((g) => (
          <div key={g.topic} className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{g.topic}</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {g.items.map((i) => (
                <li key={i.id}>
                  <a href={href(`/items/${i.id}`)} className="block rounded-xl border border-line bg-surface p-3">
                    <span className="font-medium">{i.title}</span>
                    {i.line && <span className="mt-0.5 block line-clamp-2 text-sm text-muted">{i.line}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="New for you">
        {d.finds.length === 0 && <p className="text-muted">No new finds this week.</p>}
        {d.finds.map((f) => (
          <div key={f.topic} className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{f.topic}</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {f.items.map((i) => (
                <li key={i.url}>
                  <a href={href(i.url)} target="_blank" rel="noreferrer" className="block rounded-xl border border-line bg-surface p-3">
                    <span className="font-medium">{i.title} ↗</span>
                    <span className="mt-0.5 block text-sm text-muted">{i.why}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{new URL(i.url).hostname}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
