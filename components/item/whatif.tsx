'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/api';
import { LIKELIHOOD_LABEL, SCENARIO_MAX, suggestedScenarios, type WhatIf, type WhatIfContent } from '@/lib/whatif/schema';

/** A card still "thinking" after this long is probably stuck: offer Try again. */
const STUCK_MS = 3 * 60_000;

interface Props {
  itemId: string;
  whatifs: WhatIf[];
  itemTitle: string | null;
  /** Replace (or add) one what-if in the page's list. */
  onChange: (w: WhatIf) => void;
  /** Put a question in the item's chat box. */
  onAsk: (question: string) => void;
}

/**
 * What if… on the item page (docs/what-if.md B4): the main card, other
 * scenarios already asked, buttons for the suggested ones, and a box for
 * your own. Cards open on tap; ?whatif=1 (the ready push's button) opens the
 * main one straight away.
 */
export function WhatIfSection({ itemId, whatifs, itemTitle, onChange, onAsk }: Props) {
  const main = whatifs.find((w) => w.kind === 'main');
  const extras = whatifs.filter((w) => w.kind !== 'main');
  const suggested = suggestedScenarios(whatifs);
  const [asking, setAsking] = useState<string | null>(null);
  const [own, setOwn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // From the push's "What if…" button: open the main card once, then drop the flag so Back doesn't repeat it.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !main) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('whatif') !== '1') return;
    autoOpened.current = true;
    params.delete('whatif');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    setOpenId(main.id);
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [main]);

  async function ask(scenario: string) {
    const text = scenario.trim();
    if (!text || asking) return;
    setAsking(text);
    setError(null);
    try {
      const { whatif } = await api<{ whatif: WhatIf }>(`/api/items/${itemId}/whatifs`, { body: { scenario: text } });
      onChange(whatif);
      setOpenId(whatif.id);
      setOwn('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAsking(null);
    }
  }

  return (
    <section ref={sectionRef} className="mt-5 scroll-mt-4">
      {main && (
        <WhatIfCard
          whatif={main}
          open={openId === main.id}
          onToggle={() => setOpenId(openId === main.id ? null : main.id)}
          onChange={onChange}
          onAsk={onAsk}
          itemTitle={itemTitle}
          primary
        />
      )}

      {extras.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {extras.map((w) => (
            <WhatIfCard
              key={w.id}
              whatif={w}
              open={openId === w.id}
              onToggle={() => setOpenId(openId === w.id ? null : w.id)}
              onChange={onChange}
              onAsk={onAsk}
              itemTitle={itemTitle}
            />
          ))}
        </div>
      )}

      {(suggested.length > 0 || main?.status === 'done') && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggested.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={asking !== null}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm disabled:opacity-50"
            >
              {asking === s ? 'Thinking it through…' : s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(own);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          maxLength={SCENARIO_MAX}
          placeholder={main ? 'Your own what-if…' : 'Ask a what-if about this…'}
          aria-label="Your own what-if"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          disabled={asking !== null || own.trim().length < 3}
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {asking !== null && asking === own.trim() ? '…' : 'Ask'}
        </button>
      </form>
      {asking && asking === own.trim() && <p className="mt-2 text-sm text-muted">Searching and thinking it through — about 30 seconds…</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

function WhatIfCard({
  whatif,
  open,
  onToggle,
  onChange,
  onAsk,
  itemTitle,
  primary = false,
}: {
  whatif: WhatIf;
  open: boolean;
  onToggle: () => void;
  onChange: (w: WhatIf) => void;
  onAsk: (question: string) => void;
  itemTitle: string | null;
  primary?: boolean;
}) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Re-check "stuck" once a minute while it's thinking.
  useEffect(() => {
    if (whatif.status !== 'pending') return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [whatif.status]);

  // The first time it's opened is what "are these read?" is measured on.
  const logged = useRef(Boolean(whatif.opened_at));
  useEffect(() => {
    if (!open || logged.current || whatif.status !== 'done') return;
    logged.current = true;
    api(`/api/whatifs/${whatif.id}/open`, { method: 'POST' }).catch(() => {});
  }, [open, whatif.id, whatif.status]);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const res = await api<{ whatif: WhatIf }>(`/api/whatifs/${whatif.id}/retry`, { method: 'POST' });
      onChange(res.whatif);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRetrying(false);
    }
  }

  const stuck = whatif.status === 'pending' && now - Date.parse(whatif.created_at) > STUCK_MS;
  const shell = `rounded-3xl border ${primary ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface'} p-4`;

  if (whatif.status !== 'done' || !whatif.content) {
    const failed = whatif.status === 'failed' || stuck;
    return (
      <div className={shell} aria-busy={!failed}>
        <Label />
        <p className={`mt-1.5 font-bold leading-snug ${primary ? 'text-lg' : ''}`}>{whatif.scenario}</p>
        {failed ? (
          <>
            <p className="mt-2 text-sm text-muted">{whatif.error ?? 'This is taking longer than it should.'}</p>
            <button
              onClick={retry}
              disabled={retrying}
              className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60"
            >
              {retrying ? 'Thinking it through…' : 'Try again'}
            </button>
          </>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" aria-hidden />
            Searching and thinking it through…
          </p>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  const c = whatif.content;
  return (
    <article className={shell}>
      <Label />
      <h2 className={`mt-1.5 font-bold leading-snug ${primary ? 'text-lg' : ''}`}>{whatif.scenario}</h2>
      <p className="mt-2 text-sm">
        <span className="mr-1.5 inline-block rounded-full border border-line bg-bg px-2 py-0.5 text-xs font-semibold">
          {LIKELIHOOD_LABEL[c.likelihood]}
        </span>
        <span className="text-muted">{c.likelihood_why}</span>
      </p>

      <h3 className="mt-4 text-sm font-semibold">Signals to watch</h3>
      <ul className="mt-1.5 flex flex-col gap-1.5 text-sm">
        {c.signals.map((s) => (
          <li key={s} className="flex gap-2">
            <span aria-hidden>👀</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>

      {open && <Details content={c} />}

      <button onClick={onToggle} aria-expanded={open} className="mt-4 text-sm font-semibold text-accent">
        {open ? 'Show less' : 'Open the full what-if →'}
      </button>

      {open && <Actions whatif={whatif} itemTitle={itemTitle} onAsk={onAsk} />}
    </article>
  );
}

function Label() {
  return (
    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
      <span aria-hidden>🤔</span> What if…
      <span className="rounded-full border border-line px-1.5 py-px text-[10px] font-semibold normal-case tracking-normal">
        Speculation
      </span>
    </p>
  );
}

function Details({ content: c }: { content: WhatIfContent }) {
  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4 text-sm">
      {c.today.length > 0 && (
        <Part title="Where it stands today">
          <ul className="flex flex-col gap-2">
            {c.today.map((f) => (
              <li key={f.text}>
                {f.text}{' '}
                {f.sources.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-block rounded-full border border-line px-1.5 text-[11px] text-muted"
                  >
                    {s.title}
                  </a>
                ))}
              </li>
            ))}
          </ul>
        </Part>
      )}
      <Part title="First effects">
        <Lines lines={c.first_effects} />
      </Part>
      <Part title="Knock-on effects">
        <Lines lines={c.knock_on} />
      </Part>
      <div className="grid grid-cols-2 gap-3">
        <Part title="Winners">
          <Lines lines={c.winners} />
        </Part>
        <Part title="Losers">
          <Lines lines={c.losers} />
        </Part>
      </div>
      <Part title="Timeline">
        <ol className="flex flex-col gap-1.5">
          {[c.timeline.near, c.timeline.medium, c.timeline.long].map((t) => (
            <li key={t.when + t.what} className="flex gap-3">
              <span className="w-20 shrink-0 font-semibold tabular-nums">{t.when}</span>
              <span>{t.what}</span>
            </li>
          ))}
        </ol>
      </Part>
    </div>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1.5 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Lines({ lines }: { lines: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-4 marker:text-muted">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

/** Debate it (a Council session on the scenario) and Ask about this (the item's chat). */
function Actions({ whatif, itemTitle, onAsk }: { whatif: WhatIf; itemTitle: string | null; onAsk: (q: string) => void }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function debate() {
    setStarting(true);
    setError(null);
    const c = whatif.content!;
    const idea = [
      whatif.scenario,
      itemTitle ? `It comes from something I saved: “${itemTitle}”.` : '',
      c.today.length ? `Where it stands today:\n${c.today.map((f) => `- ${f.text}`).join('\n')}` : '',
      `My first take: ${LIKELIHOOD_LABEL[c.likelihood].toLowerCase()} — ${c.likelihood_why}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    try {
      const { id } = await api<{ id: string }>('/api/council', { body: { idea } });
      router.push(`/council/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStarting(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={debate}
          disabled={starting}
          className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {starting ? 'Calling the Council…' : '⚖️ Debate it'}
        </button>
        <button onClick={() => onAsk(`About “${whatif.scenario}” — `)} className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-semibold">
          💬 Ask about this
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
