'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/api';
import { SectionLabel } from '@/components/explainer-card';
import type { ItemOutputRow } from '@/lib/supabase/database.types';
import { LIKELIHOOD_LABEL, MAX_EXTRA, sameScenario, SCENARIO_MAX, type WhatIf } from '@/lib/whatif/schema';

type Card = { id: string; content: WhatIf };

const LIKELIHOOD_STYLE: Record<WhatIf['likelihood']['level'], string> = {
  low: 'bg-line text-muted',
  medium: 'bg-warm/15 text-warm',
  high: 'bg-success/15 text-success',
};

/**
 * What if… (docs/what-if.md B4): the save's scenario, thought through. Shows
 * the scenario, how likely it is and three signals to watch; tap for the rest.
 * Under it: other scenarios, your own, Debate it (Council) and Ask about this.
 */
export function WhatIfSection({
  itemId,
  outputs,
  onAdded,
  onAsk,
}: {
  itemId: string;
  /** The save's 'whatif' outputs. */
  outputs: ItemOutputRow[];
  onAdded: (output: ItemOutputRow) => void;
  /** Puts a question into the item's chat box. */
  onAsk: (question: string) => void;
}) {
  const router = useRouter();
  const cards: Card[] = outputs
    .map((o) => ({ id: o.id, content: o.content as unknown as WhatIf }))
    .sort((a, b) => Number(b.content.origin === 'auto') - Number(a.content.origin === 'auto'));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [own, setOwn] = useState('');
  const section = useRef<HTMLElement>(null);
  const card = cards.find((c) => c.id === selectedId) ?? cards[0];

  // One 'whatif_open' per visit, the first time the full card is shown.
  const logged = useRef(false);
  function expand(next: boolean) {
    setOpen(next);
    if (next && !logged.current) {
      logged.current = true;
      api('/api/events', { body: { type: 'whatif_open', itemId } }).catch(() => {});
    }
  }

  // ?whatif=1 comes from a notification's "What if" button or the digest: open
  // the card and bring it into view. Read from the live URL and dropped, so a
  // reload doesn't count as another open.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !card) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('whatif') !== '1') return;
    deepLinked.current = true;
    params.delete('whatif');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    expand(true);
    section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Runs once, when the card first exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(card)]);

  async function add(body: { origin: 'auto' } | { origin: 'other' | 'custom'; scenario: string }) {
    setBusy(body.origin === 'auto' ? 'auto' : body.scenario);
    setError(null);
    try {
      const { whatIf } = await api<{ whatIf: ItemOutputRow }>(`/api/items/${itemId}/whatif`, { body });
      onAdded(whatIf);
      setSelectedId(whatIf.id);
      if (body.origin === 'custom') setOwn('');
      expand(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  async function debate(scenario: string) {
    setBusy('debate');
    setError(null);
    try {
      // Sent as a referral of this save, so the council gets what it says and the session links back here.
      const { id } = await api<{ id: string }>('/api/council', { body: { itemId, question: scenario } });
      router.push(`/council/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(null);
    }
  }

  const ownForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (own.trim()) add({ origin: 'custom', scenario: own });
      }}
      className="mt-3 flex gap-2"
    >
      <input
        value={own}
        onChange={(e) => setOwn(e.target.value)}
        maxLength={SCENARIO_MAX}
        placeholder="Your own what-if…"
        aria-label="Your own what-if"
        className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />
      <button disabled={busy !== null || !own.trim()} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent disabled:opacity-60">
        {busy !== null && busy === own ? '…' : 'Go'}
      </button>
    </form>
  );

  if (!card) {
    return (
      <section ref={section} className="mt-5 rounded-3xl border border-dashed border-line p-4">
        <p className="flex items-center gap-2 font-bold">
          <span aria-hidden>💭</span> What if…
        </p>
        <p className="mt-1 text-sm text-muted">
          {busy ? 'Thinking it through. This takes about half a minute.' : 'See where this could lead: who wins, who loses, and signs to watch.'}
        </p>
        <button
          onClick={() => add({ origin: 'auto' })}
          disabled={busy !== null}
          className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-on-accent disabled:opacity-70"
        >
          {busy === 'auto' ? 'Thinking it through…' : 'Think it through'}
        </button>
        {ownForm}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </section>
    );
  }

  const w = card.content;
  const extras = cards.filter((c) => c.content.origin !== 'auto').length;
  const suggestions = w.other_scenarios.filter((s) => !cards.some((c) => sameScenario(c.content.scenario, s)));
  const canAdd = extras < MAX_EXTRA;

  return (
    <section ref={section} className="mt-5 scroll-mt-4">
      {cards.length > 1 && (
        <div className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              aria-pressed={c.id === card.id}
              className={`max-w-[15rem] shrink-0 truncate rounded-full px-3 py-1.5 text-xs font-medium ${
                c.id === card.id ? 'bg-ink text-bg' : 'border border-line bg-surface'
              }`}
            >
              {c.content.scenario}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-accent/30 bg-accent/10">
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold text-accent">
              <span aria-hidden className="text-lg">
                💭
              </span>
              What if…
            </p>
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Speculation
            </span>
          </div>
          <h2 className="mt-2 text-lg font-extrabold leading-snug">{w.scenario}</h2>

          <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${LIKELIHOOD_STYLE[w.likelihood.level]}`}>
              {LIKELIHOOD_LABEL[w.likelihood.level]}
            </span>
            <span>{w.likelihood.why}</span>
          </p>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Signals to watch</p>
          <ol className="mt-2 flex flex-col gap-2">
            {w.signals.map((signal, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
                  {i + 1}
                </span>
                <span>{signal}</span>
              </li>
            ))}
          </ol>
        </div>

        {open && (
          <div className="flex flex-col gap-5 border-t border-accent/20 bg-surface p-4">
            {w.today.length > 0 && (
              <Block label="Where things stand today">
                <ul className="flex flex-col gap-2.5">
                  {w.today.map((t, i) => (
                    <li key={i} className="text-sm leading-relaxed">
                      {t.fact}{' '}
                      <a href={t.url} target="_blank" rel="noreferrer" className="whitespace-nowrap text-xs font-medium text-accent">
                        {t.site} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </Block>
            )}
            <Block label="First effects">
              <Lines items={w.first_effects} />
            </Block>
            <Block label="Knock-on effects">
              <Lines items={w.knock_on} />
            </Block>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-success/10 p-3">
                <p className="text-xs font-bold text-success">Winners</p>
                <Lines items={w.winners} />
              </div>
              <div className="rounded-2xl bg-danger/10 p-3">
                <p className="text-xs font-bold text-danger">Losers</p>
                <Lines items={w.losers} />
              </div>
            </div>
            <Block label="Timeline">
              <ol className="flex flex-col gap-2.5">
                {[w.timeline.near, w.timeline.medium, w.timeline.long].map((p, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="w-24 shrink-0 font-semibold tabular-nums">{p.when}</span>
                    <span>{p.what}</span>
                  </li>
                ))}
              </ol>
            </Block>
          </div>
        )}

        <button
          onClick={() => expand(!open)}
          aria-expanded={open}
          className="w-full border-t border-accent/20 bg-surface py-3 text-sm font-semibold text-accent"
        >
          {open ? 'Show less' : 'Show the full picture'}
        </button>
      </div>

      {canAdd && suggestions.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => add({ origin: 'other', scenario: s })}
              disabled={busy !== null}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-left text-sm font-medium disabled:opacity-60"
            >
              <span>{s}</span>
              <span aria-hidden className="shrink-0 text-muted">
                {busy === s ? '…' : '→'}
              </span>
            </button>
          ))}
        </div>
      )}
      {canAdd ? ownForm : <p className="mt-3 text-xs text-muted">That&apos;s the limit of {MAX_EXTRA} extra what-ifs for one save.</p>}
      {busy !== null && busy !== 'debate' && <p className="mt-2 text-sm text-muted">Thinking it through. This takes about half a minute.</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => debate(w.scenario)}
          disabled={busy !== null}
          className="rounded-xl border border-line bg-surface py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {busy === 'debate' ? 'Starting…' : '🏛️ Debate it'}
        </button>
        <button onClick={() => onAsk(w.scenario)} className="rounded-xl border border-line bg-surface py-2.5 text-sm font-medium">
          💬 Ask about this
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Lines({ items }: { items: string[] }) {
  return (
    <ul className="mt-1.5 flex flex-col gap-1.5">
      {items.map((line, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
