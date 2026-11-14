'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/components/api';
import { KIND_LABEL } from '@/components/types';
import type { Stats } from '@/lib/stats';

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—');
const weekLabel = (start: string) => new Date(`${start}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** How the app is actually being used: saves, opens, what-ifs, recipes, and the last 8 weeks. */
export function StatsView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ stats: Stats }>('/api/stats').then(
      (r) => setStats(r.stats),
      (err) => setError(err instanceof Error ? err.message : 'Something went wrong'),
    );
  }, []);

  const done = stats ? stats.opens.opened + stats.opens.neverOpened : 0;

  return (
    <div className="flex flex-col gap-7">
      <header>
        <Link href="/settings" className="text-sm text-muted">
          ← Settings
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Your stats</h1>
        <p className="mt-1 text-sm text-muted">What you save, what you open, and what you come back to.</p>
      </header>

      {error && <p className="text-danger">{error}</p>}
      {!stats && !error && <p className="text-muted">Loading…</p>}

      {stats && (
        <>
          <Group title="Saves">
            <Tile value={stats.saves.total} label="saved in all" />
            <Tile value={stats.saves.last7} label="in the last 7 days" />
            <Tile value={stats.saves.last30} label="in the last 30 days" />
            <Tile value={stats.saves.failed} label="couldn't be read" />
          </Group>

          <Group title="Do you open them?" note={`Of the ${done} saves that finished processing.`}>
            <Tile value={pct(stats.opens.opened, done)} label={`opened (${stats.opens.opened})`} />
            <Tile value={stats.opens.neverOpened} label="never opened" />
            <Tile value={stats.opens.moreThanOnce} label="opened more than once" />
            <Tile value={stats.opens.cameBack} label="came back to after a day or more" />
          </Group>

          <section>
            <h2 className="font-semibold">By kind</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="px-3.5 py-2.5 font-medium">
                      Kind
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">
                      Saves
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">
                      Opened
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 text-right font-medium">
                      Came back
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {stats.byKind.map((k) => (
                    <tr key={k.kind}>
                      <th scope="row" className="px-3.5 py-2.5 text-left font-medium">
                        {KIND_LABEL[k.kind]}
                      </th>
                      <td className="px-2 py-2.5 text-right tabular-nums">{k.saves}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{k.opened}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums">{k.cameBack}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">Came back = opened again more than a day after saving.</p>
          </section>

          <Group title="What ifs">
            <Tile value={stats.whatIfs.written} label="written" />
            <Tile value={pct(stats.whatIfs.opened, stats.whatIfs.written)} label={`opened (${stats.whatIfs.opened})`} />
          </Group>

          <Group title="Recipes">
            <Tile value={stats.recipes.saved} label="saved" />
            <Tile value={stats.recipes.wantToCook} label="on your Want to cook list" />
            <Tile value={stats.recipes.cooked} label="cooked at least once" />
            <Tile value={stats.recipes.timesCooked} label="times cooked in all" />
          </Group>

          <Group title="Everything else">
            <Tile value={stats.reviewsDone} label="review cards done" />
            <Tile value={stats.lessonsPlayed} label="lessons played" />
            <Tile value={stats.digestTaps} label="digest links tapped" />
          </Group>

          <section>
            <h2 className="font-semibold">The last 8 weeks</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="px-3.5 py-2.5 font-medium">
                      Week of
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">
                      Saves
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 text-right font-medium">
                      Opens
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...stats.weeks].reverse().map((w, i) => (
                    <tr key={w.start} className={w.saves + w.opens === 0 ? 'text-muted' : ''}>
                      <th scope="row" className="px-3.5 py-2.5 text-left font-medium">
                        {weekLabel(w.start)}
                        {i === 0 && <span className="ml-1.5 text-xs font-normal text-muted">this week</span>}
                      </th>
                      <td className="px-2 py-2.5 text-right tabular-nums">{w.saves}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums">{w.opens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <p className="text-2xl font-extrabold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted">{label}</p>
    </div>
  );
}
