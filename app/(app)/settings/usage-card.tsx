'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/components/api';
import { formatUsd, previousMonth, type UsageSummary } from '@/lib/ai/usage-summary';

const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });

/** What the AI has cost this month (estimated from token counts), by feature and by save. */
export function UsageCard() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<UsageSummary>('/api/usage')
      .then(setUsage)
      .catch(() => setFailed(true));
  }, []);

  return (
    <section>
      <h2 className="font-semibold">AI usage</h2>
      <p className="mt-1 text-sm text-muted">What the AI behind your saves, chats and digests has cost, estimated from Google&apos;s list prices.</p>
      {failed ? (
        <p className="mt-3 text-sm text-danger">Couldn&apos;t load your usage — try again later.</p>
      ) : !usage ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : (
        <Usage usage={usage} />
      )}
    </section>
  );
}

function Usage({ usage }: { usage: UsageSummary }) {
  const { thisMonth, lastMonth, byFeature, topSaves, perSave, search, unpriced } = usage;
  if (!thisMonth.calls && !lastMonth.calls) {
    return <p className="mt-3 text-sm text-muted">Nothing logged yet. Each AI call is counted from now on.</p>;
  }
  const max = Math.max(...byFeature.map((f) => f.costUsd), 0);

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label={`${monthName(usage.month)} so far`} value={formatUsd(thisMonth.costUsd)} strong />
        <Stat label={monthName(previousMonth(usage.month))} value={formatUsd(lastMonth.costUsd)} />
      </div>
      {perSave && (
        <p className="text-sm text-muted">
          About <span className="font-medium text-ink">{formatUsd(perSave.avgUsd)}</span> per save this month, across{' '}
          {perSave.saves} {perSave.saves === 1 ? 'save' : 'saves'} (chat about a save counts towards it).
        </p>
      )}

      {byFeature.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-3">
          <h3 className="text-sm font-medium">This month, by feature</h3>
          <ul className="mt-2 flex flex-col gap-2.5">
            {byFeature.map((f) => (
              <li key={f.feature}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{f.label}</span>
                  <span className="tabular-nums text-muted">
                    {formatUsd(f.costUsd)} · {f.calls} {f.calls === 1 ? 'call' : 'calls'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-line" aria-hidden>
                  <div
                    className="h-1.5 rounded-full bg-accent"
                    style={{ width: `${max > 0 ? Math.max((f.costUsd / max) * 100, 2) : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topSaves.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Costliest saves this month</h3>
          <ol className="mt-1.5 flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
            {topSaves.map((s) => (
              <li key={s.itemId}>
                <Link href={`/items/${s.itemId}`} className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">{s.title ?? 'Untitled save'}</span>
                  <span className="shrink-0 tabular-nums text-muted">{formatUsd(s.costUsd)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      {unpriced.length > 0 && (
        <p className="rounded-xl border border-line bg-surface p-3 text-sm">
          <span className="font-medium">Not counted yet:</span> {unpriced.map((u) => u.model).join(', ')} — no price for{' '}
          {unpriced.length === 1 ? 'this model' : 'these models'} in HeyToolie yet, so the totals above leave{' '}
          {unpriced.length === 1 ? 'it' : 'them'} out.
        </p>
      )}

      <p className="text-xs text-muted">
        {search.queries > 0 && (
          <>
            Includes {formatUsd(search.costUsd)} for {search.queries.toLocaleString('en-GB')} Google{' '}
            {search.queries === 1 ? 'search' : 'searches'} (digest finds). Google gives {search.freePerMonth.toLocaleString('en-GB')}{' '}
            free a month per account, so your bill may be lower.{' '}
          </>
        )}
        These are estimates: your Google AI Studio bill is the real number. Council costs are as OpenRouter reported them.
      </p>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 tabular-nums ${strong ? 'text-2xl font-bold' : 'text-xl font-semibold text-muted'}`}>{value}</p>
    </div>
  );
}
