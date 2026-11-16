'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/components/api';
import { SectionLabel } from '@/components/explainer-card';
import { FrameworkCard } from '@/components/framework-card';
import type { Framework } from '@/lib/playbook/schema';

/**
 * The frameworks this save put in the playbook (docs/playbook.md). A save with
 * none offers to look for some: older saves, or ones the classifier didn't flag.
 */
export function FrameworksSection({ itemId }: { itemId: string }) {
  const [frameworks, setFrameworks] = useState<Framework[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    api<{ frameworks: Framework[] }>(`/api/items/${itemId}/frameworks`).then(
      (r) => setFrameworks(r.frameworks),
      () => setFrameworks([]),
    );
  }, [itemId]);

  async function pull() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ frameworks: Framework[] }>(`/api/items/${itemId}/frameworks`, { method: 'POST' });
      setFrameworks(res.frameworks);
      if (!res.frameworks.length) setMessage({ text: 'Nothing reusable in this one. It informs more than it teaches a method.', error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Something went wrong', error: true });
    } finally {
      setBusy(false);
    }
  }

  if (frameworks === null) return null;

  if (!frameworks.length) {
    return (
      <section className="mt-7">
        {message && !message.error ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">{message.text}</p>
        ) : (
          <button
            onClick={pull}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-left disabled:opacity-60"
          >
            <span aria-hidden className={`text-xl ${busy ? 'animate-bounce motion-reduce:animate-none' : ''}`}>
              📒
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{busy ? 'Looking for frameworks…' : 'Pull out frameworks'}</span>
              <span className="block text-xs text-muted">Keep any method or mental model this teaches in your playbook</span>
            </span>
          </button>
        )}
        {message?.error && <p className="mt-2 text-sm text-danger">{message.text}</p>}
      </section>
    );
  }

  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>For your playbook</SectionLabel>
        <Link href="/playbook" className="text-xs font-medium text-accent">
          Open playbook →
        </Link>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {frameworks.map((f) => (
          <li key={f.id}>
            <FrameworkCard framework={f} showSources={false}>
              <Link href={`/playbook?use=${f.id}`} className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent">
                Apply to an idea
              </Link>
            </FrameworkCard>
          </li>
        ))}
      </ul>
    </section>
  );
}
