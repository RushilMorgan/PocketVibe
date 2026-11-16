'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/components/api';
import { SectionLabel } from '@/components/explainer-card';
import { FrameworkCard } from '@/components/framework-card';
import { timeAgo } from '@/components/time-ago';
import { IDEA_MAX, IDEA_MIN, MAX_LENSES, type Framework, type Run, type RunSummary } from '@/lib/playbook/schema';
import { areaCounts, filterFrameworks } from '@/lib/playbook/shape';

/** Show the search box and area chips once there's enough to need them. */
const SEARCH_FROM = 6;

/**
 * The Playbook tab (docs/playbook.md): bring an idea and work it through the
 * frameworks you've kept, see past runs, and browse every framework.
 * `use` is a framework id to start with (from a save's page).
 */
export function PlaybookView({ use }: { use?: string }) {
  const router = useRouter();
  const [frameworks, setFrameworks] = useState<Framework[] | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [idea, setIdea] = useState('');
  const [using, setUsing] = useState<string[]>(use ? [use] : []);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [area, setArea] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<{ frameworks: Framework[]; runs: RunSummary[] }>('/api/playbook').then(
      (r) => {
        setFrameworks(r.frameworks);
        setRuns(r.runs);
      },
      (err) => {
        setFrameworks([]);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      },
    );
  }, []);

  const areas = useMemo(() => areaCounts(frameworks ?? []).slice(0, 12), [frameworks]);
  const shown = useMemo(() => filterFrameworks(frameworks ?? [], { search, area }), [frameworks, search, area]);
  const pinned = (frameworks ?? []).filter((f) => using.includes(f.id));

  function toggleUse(id: string) {
    setUsing((u) => (u.includes(id) ? u.filter((x) => x !== id) : [...u, id].slice(-MAX_LENSES)));
    box.current?.focus();
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function remove(f: Framework) {
    if (!confirm(`Remove "${f.name}" from your playbook? The save it came from stays.`)) return;
    try {
      await api(`/api/playbook/frameworks/${f.id}`, { method: 'DELETE' });
      setFrameworks((list) => (list ?? []).filter((x) => x.id !== f.id));
      setUsing((u) => u.filter((x) => x !== f.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const { run } = await api<{ run: Run }>('/api/playbook/runs', {
        body: { idea, frameworkIds: pinned.length ? pinned.map((f) => f.id) : undefined },
      });
      router.push(`/playbook/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSending(false);
    }
  }

  const empty = frameworks?.length === 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
      <p className="mt-1 text-sm text-muted">
        The frameworks and mental models from what you save, kept in one place. Bring an idea and work it through them.
      </p>

      {!empty && (
        <form onSubmit={submit} className="mt-5">
          <textarea
            ref={box}
            required
            minLength={IDEA_MIN}
            maxLength={IDEA_MAX}
            rows={4}
            placeholder="What are you working on? e.g. A subscription box for home bakers · Should I niche down my agency? · A pricing change for…"
            aria-label="The idea to work through"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
          />
          {pinned.length > 0 && (
            <ul className="mt-2 flex flex-wrap items-center gap-1.5">
              <li className="text-xs text-muted">Using</li>
              {pinned.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setUsing((u) => u.filter((x) => x !== f.id))}
                    aria-label={`Stop using ${f.name}`}
                    className="flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent"
                  >
                    {f.name} <span aria-hidden>✕</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {pinned.length ? 'Uses the ones you chose' : `Picks up to ${MAX_LENSES} that fit`} · about a minute
            </p>
            <button
              disabled={sending || idea.trim().length < IDEA_MIN}
              className="shrink-0 rounded-xl bg-accent px-4 py-2.5 font-medium text-on-accent disabled:opacity-60"
            >
              {sending ? 'Working it through…' : 'Work it through'}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {runs.length > 0 && (
        <section className="mt-8">
          <SectionLabel>Worked through</SectionLabel>
          <ul className="mt-3 flex flex-col gap-2">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/playbook/runs/${r.id}`} className="block rounded-xl border border-line bg-surface p-4">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-medium leading-snug">{r.title}</span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(r.createdAt)}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted">{r.frameworks.join(' · ')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        {frameworks === null && <p className="text-muted">Loading…</p>}
        {empty && (
          <div className="rounded-xl border border-dashed border-line p-6 text-center text-muted">
            <p aria-hidden className="text-3xl">
              📒
            </p>
            <p className="mt-2 font-medium text-ink">Nothing here yet</p>
            <p className="mt-1 text-sm">
              When something you save teaches a framework, a mental model or a method, it lands here on its own. For a save you
              already have, open it and tap <span className="font-medium text-ink">Pull out frameworks</span>.
            </p>
          </div>
        )}
        {frameworks && !empty && (
          <>
            <SectionLabel>
              Your frameworks <span className="font-medium normal-case tracking-normal">· {frameworks.length}</span>
            </SectionLabel>
            {frameworks.length >= SEARCH_FROM && (
              <>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, use or area"
                  aria-label="Search your frameworks"
                  className="mt-3 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
                <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                  {areas.map((a) => (
                    <button
                      key={a.area}
                      onClick={() => setArea((cur) => (cur === a.area ? null : a.area))}
                      aria-pressed={area === a.area}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
                        area === a.area ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'
                      }`}
                    >
                      {a.area} <span className={area === a.area ? '' : 'text-muted'}>{a.count}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <ul className="mt-3 flex flex-col gap-2">
              {shown.map((f) => (
                <li key={f.id}>
                  <FrameworkCard framework={f} defaultOpen={f.id === use}>
                    <button onClick={() => toggleUse(f.id)} className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent">
                      {using.includes(f.id) ? 'Using this ✓' : 'Apply to an idea'}
                    </button>
                    <button onClick={() => remove(f)} className="rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-muted">
                      Remove
                    </button>
                  </FrameworkCard>
                </li>
              ))}
              {shown.length === 0 && <li className="py-4 text-center text-sm text-muted">No framework matches that.</li>}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
