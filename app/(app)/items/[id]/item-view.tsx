'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/components/api';
import { Chat } from '@/components/chat';
import { ExplainerCard } from '@/components/explainer-card';
import { RecipeCard } from '@/components/recipe-card';
import { DiagramCard } from '@/components/diagram-card';
import { KIND_LABEL, type Item, type SimilarItem } from '@/components/types';
import type { Diagram, ExplainMode, Explainer, Recipe } from '@/lib/handlers/schemas';
import { TEMPLATE_LABEL, TEMPLATES, type Template } from '@/lib/lessons/schema';

const POLL_MS = 2500;

type Output = Item['outputs'][number];
type OnOutput = (type: 'explainer' | 'diagram', value: Explainer | Diagram, fileUrl?: string | null) => void;

/**
 * One saved item: "Got it, working on it…" while queued, Retry on failure,
 * then the output with Play, Explain simpler · Go deeper · Diagram · Similar ·
 * 👍/👎 and a chat box about this item.
 */
export function ItemView({ id }: { id: string }) {
  const [item, setItem] = useState<Item | null>(null);
  const [thumbs, setThumbs] = useState(0);
  const [playLessonId, setPlayLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ item: Item; thumbs: number; playLessonId: string | null }>(`/api/items/${id}`);
      setItem(res.item);
      setThumbs(res.thumbs);
      setPlayLessonId(res.playLessonId);
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

  /** Swap in a regenerated explainer or new diagram without a refetch. */
  const putOutput: OnOutput = (type, value, fileUrl = null) => {
    const content = value as unknown as Output['content'];
    setItem((prev) => {
      if (!prev) return prev;
      const existing = prev.outputs.find((o) => o.type === type);
      const next: Output = existing
        ? { ...existing, content, file_url: fileUrl }
        : { id: type, item_id: prev.id, user_id: prev.user_id, type, content, file_url: fileUrl, created_at: new Date().toISOString() };
      return { ...prev, outputs: [...prev.outputs.filter((o) => o.type !== type), next] };
    });
  };

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
            <button onClick={retry} className="mt-4 rounded-xl bg-accent px-4 py-2 font-medium text-on-accent">
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
          <Actions
            item={item}
            thumbs={thumbs}
            setThumbs={setThumbs}
            onOutput={putOutput}
            playLessonId={playLessonId}
          />
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
  const diagram = item.outputs.find((o) => o.type === 'diagram');
  if (recipe) return <RecipeCard recipe={recipe.content as unknown as Recipe} />;
  return (
    <>
      {item.kind && <p className="text-xs text-muted">{KIND_LABEL[item.kind]}</p>}
      <h1 className="mt-1 mb-4 text-xl font-semibold leading-snug">{item.title}</h1>
      {explainer && <ExplainerCard explainer={explainer.content as unknown as Explainer} />}
      {diagram?.file_url && (
        <DiagramCard src={diagram.file_url} caption={(diagram.content as unknown as Diagram).caption} />
      )}
    </>
  );
}

function Actions({
  item,
  thumbs,
  setThumbs,
  onOutput,
  playLessonId,
}: {
  item: Item;
  thumbs: number;
  setThumbs: (v: number) => void;
  onOutput: OnOutput;
  /** A ready, unplayed lesson: Play goes straight to it. */
  playLessonId: string | null;
}) {
  const [explaining, setExplaining] = useState<ExplainMode | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const router = useRouter();
  const [similar, setSimilar] = useState<SimilarItem[] | null>(null);
  const [showSimilar, setShowSimilar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isExplainer = item.outputs.some((o) => o.type === 'explainer');
  const hasDiagram = item.outputs.some((o) => o.type === 'diagram');

  async function reExplain(mode: ExplainMode) {
    setExplaining(mode);
    setError(null);
    try {
      const { explainer } = await api<{ explainer: Explainer }>(`/api/items/${item.id}/explain`, { body: { mode } });
      onOutput('explainer', explainer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setExplaining(null);
    }
  }

  async function drawDiagram() {
    setDrawing(true);
    setError(null);
    try {
      const { diagram } = await api<{ diagram: { content: Diagram; fileUrl: string } }>(`/api/items/${item.id}/diagram`, {
        method: 'POST',
      });
      onOutput('diagram', diagram.content, diagram.fileUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setDrawing(false);
    }
  }

  /** Opens the ready lesson (usually pre-written by the pipeline), else writes one. */
  async function play(template?: Template) {
    if (!template && playLessonId) {
      router.push(`/play/${playLessonId}`);
      return;
    }
    setPlaying(true);
    setError(null);
    try {
      const { lessonId } = await api<{ lessonId: string }>('/api/lessons', { body: { itemId: item.id, template } });
      router.push(`/play/${lessonId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPlaying(false);
    }
  }

  // ?play=1 comes from the notification's "Play lesson" button: start the lesson
  // without a tap. Read from the live URL (not a server prop, which Next caches)
  // and dropped first, so Back from the lesson lands here instead of looping.
  const autoPlayed = useRef(false);
  useEffect(() => {
    if (autoPlayed.current || item.kind === 'recipe') return;
    if (new URLSearchParams(window.location.search).get('play') !== '1') return;
    autoPlayed.current = true;
    const rest = new URLSearchParams(window.location.search);
    rest.delete('play');
    const query = rest.toString();
    window.history.replaceState(window.history.state, '', `/items/${item.id}${query ? `?${query}` : ''}`);
    play();
    // Runs once on mount; play() only reads props from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {isExplainer && (
        <div className="mb-3">
          <button
            onClick={() => play()}
            disabled={playing}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 font-semibold text-on-accent disabled:opacity-70"
          >
            <span aria-hidden>▶</span>
            {playing ? 'Getting your lesson ready…' : 'Play · 2-minute lesson'}
          </button>
          <p className="mt-1.5 text-center text-xs text-muted">
            or play as{' '}
            {TEMPLATES.filter((t) => t !== 'spot_bug' || item.kind === 'tech').map((t, i) => (
              <span key={t}>
                {i > 0 && ' · '}
                <button onClick={() => play(t)} disabled={playing} className="text-accent disabled:opacity-50">
                  {TEMPLATE_LABEL[t].toLowerCase()}
                </button>
              </span>
            ))}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {isExplainer && (
          <>
            <button className={button} disabled={!!explaining} onClick={() => reExplain('simpler')}>
              {explaining === 'simpler' ? 'Simplifying…' : 'Explain simpler'}
            </button>
            <button className={button} disabled={!!explaining} onClick={() => reExplain('deeper')}>
              {explaining === 'deeper' ? 'Digging in…' : 'Go deeper'}
            </button>
            {!hasDiagram && (
              <button className={button} disabled={drawing} onClick={drawDiagram}>
                {drawing ? 'Drawing…' : 'Diagram'}
              </button>
            )}
          </>
        )}
        <button className={button} aria-expanded={showSimilar} onClick={toggleSimilar}>
          Similar
        </button>
        <button
          className={`${button} ${thumbs === 1 ? 'border-accent bg-accent text-on-accent' : ''}`}
          aria-pressed={thumbs === 1}
          aria-label="Thumbs up"
          onClick={() => vote(1)}
        >
          👍
        </button>
        <button
          className={`${button} ${thumbs === -1 ? 'border-danger bg-danger text-on-accent' : ''}`}
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
