'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/components/api';
import { Chat } from '@/components/chat';
import { ExplainerCard } from '@/components/explainer-card';
import { RecipeCard } from '@/components/recipe-card';
import { KIND_LABEL, type Item, type SimilarItem } from '@/components/types';
import type { ExplainMode, Explainer, Recipe } from '@/lib/handlers/schemas';

const POLL_MS = 2500;

/**
 * One saved item: "Got it, working on it…" while queued, Retry on failure,
 * then the output with Explain simpler · Go deeper · Similar · 👍/👎 and a
 * chat box about this item.
 */
export function ItemView({ id }: { id: string }) {
  const [item, setItem] = useState<Item | null>(null);
  const [thumbs, setThumbs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ item: Item; thumbs: number }>(`/api/items/${id}`);
      setItem(res.item);
      setThumbs(res.thumbs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Log one 'opened' per visit (the day-30 test counts these).
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    api('/api/events', { body: { type: 'opened', itemId: id } }).catch(() => {});
  }, [id]);

  const pending = !item || item.status === 'queued' || item.status === 'processing';
  useEffect(() => {
    if (!pending || error) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [pending, error, load]);

  async function retry() {
    await api(`/api/items/${id}/retry`, { method: 'POST' });
    await load();
  }

  /** Swap in a regenerated explainer without a refetch. */
  function replaceExplainer(explainer: Explainer) {
    const content = explainer as unknown as Item['outputs'][number]['content'];
    setItem((prev) =>
      prev && { ...prev, outputs: prev.outputs.map((o) => (o.type === 'explainer' ? { ...o, content } : o)) },
    );
  }

  if (error) {
    return (
      <div>
        <BackLink />
        <p className="mt-6 text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <BackLink />
      <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
        {pending && (
          <>
            <p className="text-lg font-medium">Got it, working on it…</p>
            <p className="mt-1 text-sm text-muted">Usually under a minute. You&apos;ll get a notification if they&apos;re on.</p>
          </>
        )}
        {item?.status === 'failed' && (
          <>
            <p className="text-lg font-medium">Couldn&apos;t read that one</p>
            {item.error && <p className="mt-1 text-sm text-muted">{item.error}</p>}
            <button onClick={retry} className="mt-4 rounded-xl bg-accent px-4 py-2 font-medium text-white">
              Retry
            </button>
          </>
        )}
        {item?.status === 'done' && <Done item={item} />}
        {item && (
          <a href={item.url} target="_blank" rel="noreferrer" className="mt-5 block truncate text-sm text-accent">
            {item.url}
          </a>
        )}
      </div>

      {item?.status === 'done' && (
        <>
          <Actions item={item} thumbs={thumbs} setThumbs={setThumbs} onExplainer={replaceExplainer} />
          <section className="mt-8">
            <h2 className="mb-3 font-semibold">Ask about this</h2>
            <Chat itemId={item.id} placeholder="e.g. what's the catch?" />
          </section>
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/" className="text-sm text-muted">
      ← All saves
    </Link>
  );
}

function Done({ item }: { item: Item }) {
  const recipe = item.outputs.find((o) => o.type === 'recipe');
  const explainer = item.outputs.find((o) => o.type === 'explainer');
  if (recipe) return <RecipeCard recipe={recipe.content as unknown as Recipe} />;
  return (
    <>
      {item.kind && <p className="text-xs text-muted">{KIND_LABEL[item.kind]}</p>}
      <h1 className="mt-1 mb-4 text-xl font-semibold leading-snug">{item.title}</h1>
      {explainer && <ExplainerCard explainer={explainer.content as unknown as Explainer} />}
    </>
  );
}

function Actions({
  item,
  thumbs,
  setThumbs,
  onExplainer,
}: {
  item: Item;
  thumbs: number;
  setThumbs: (v: number) => void;
  onExplainer: (e: Explainer) => void;
}) {
  const [explaining, setExplaining] = useState<ExplainMode | null>(null);
  const [similar, setSimilar] = useState<SimilarItem[] | null>(null);
  const [showSimilar, setShowSimilar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isExplainer = item.outputs.some((o) => o.type === 'explainer');

  async function reExplain(mode: ExplainMode) {
    setExplaining(mode);
    setError(null);
    try {
      const { explainer } = await api<{ explainer: Explainer }>(`/api/items/${item.id}/explain`, { body: { mode } });
      onExplainer(explainer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setExplaining(null);
    }
  }

  async function toggleSimilar() {
    setShowSimilar((s) => !s);
    if (similar) return;
    try {
      setSimilar((await api<{ items: SimilarItem[] }>(`/api/items/${item.id}/similar`)).items);
    } catch {
      setSimilar([]);
    }
  }

  async function vote(value: 1 | -1) {
    const next = thumbs === value ? 0 : value;
    setThumbs(next);
    try {
      await api(`/api/items/${item.id}/thumbs`, { body: { value: next } });
    } catch {
      setThumbs(thumbs);
    }
  }

  const button = 'rounded-full border border-line bg-surface px-3.5 py-2 text-sm disabled:opacity-50';
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {isExplainer && (
          <>
            <button className={button} disabled={!!explaining} onClick={() => reExplain('simpler')}>
              {explaining === 'simpler' ? 'Simplifying…' : 'Explain simpler'}
            </button>
            <button className={button} disabled={!!explaining} onClick={() => reExplain('deeper')}>
              {explaining === 'deeper' ? 'Digging in…' : 'Go deeper'}
            </button>
          </>
        )}
        <button className={button} aria-expanded={showSimilar} onClick={toggleSimilar}>
          Similar
        </button>
        <button
          className={`${button} ${thumbs === 1 ? 'border-accent bg-accent text-white' : ''}`}
          aria-pressed={thumbs === 1}
          aria-label="Thumbs up"
          onClick={() => vote(1)}
        >
          👍
        </button>
        <button
          className={`${button} ${thumbs === -1 ? 'border-danger bg-danger text-white' : ''}`}
          aria-pressed={thumbs === -1}
          aria-label="Thumbs down"
          onClick={() => vote(-1)}
        >
          👎
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {showSimilar && (
        <ul className="mt-3 flex flex-col gap-2">
          {similar === null && <li className="text-sm text-muted">Looking…</li>}
          {similar?.length === 0 && <li className="text-sm text-muted">Nothing similar saved yet.</li>}
          {similar?.map((s) => (
            <li key={s.id}>
              <Link href={`/items/${s.id}`} className="block rounded-xl border border-line bg-surface p-3 text-sm">
                {s.title ?? s.url}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
