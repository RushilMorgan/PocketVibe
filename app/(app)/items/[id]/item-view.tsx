'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/components/api';
import { Chat } from '@/components/chat';
import { DiagramCard } from '@/components/diagram-card';
import { ExplainerCard, SectionLabel } from '@/components/explainer-card';
import { Thumb } from '@/components/feed/thumb';
import { CouncilCard } from '@/components/item/council-card';
import { FrameworksSection } from '@/components/item/frameworks-section';
import { ItemHero } from '@/components/item/item-hero';
import { RecipeCard } from '@/components/recipe-card';
import { WhatIfSection } from '@/components/whatif-card';
import type { Item, SimilarItem } from '@/components/types';
import type { ItemOutputRow } from '@/lib/supabase/database.types';
import type { Cook } from '@/lib/recipes/view';
import type { Diagram, ExplainMode, Explainer, Recipe } from '@/lib/handlers/schemas';
import { TEMPLATE_LABEL, TEMPLATES, type Template } from '@/lib/lessons/schema';

const POLL_MS = 2500;

type Output = Item['outputs'][number];
type OnOutput = (type: 'explainer' | 'diagram', value: Explainer | Diagram, fileUrl?: string | null) => void;

/**
 * One saved item: a full-bleed header with its picture, then — once read —
 * the what-if card, the explainer or recipe, its frameworks for the playbook,
 * tools (re-explain, diagram, a lesson on request), similar saves, the Council card and a chat.
 * While it's being read it shows progress; on failure, Retry.
 */
export function ItemView({ id }: { id: string }) {
  const [item, setItem] = useState<Item | null>(null);
  const [thumbs, setThumbs] = useState(0);
  const [playLessonId, setPlayLessonId] = useState<string | null>(null);
  const [cooks, setCooks] = useState<Cook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState<{ text: string; n: number } | undefined>();

  const load = useCallback(async () => {
    try {
      const res = await api<{ item: Item; thumbs: number; playLessonId: string | null; cooks?: Cook[] }>(`/api/items/${id}`);
      setItem(res.item);
      setThumbs(res.thumbs);
      setPlayLessonId(res.playLessonId);
      setCooks(res.cooks ?? []);
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

  /** A new what-if card (the save's own, another scenario, or a custom one). */
  const addOutput = (output: ItemOutputRow) =>
    setItem((prev) => (prev ? { ...prev, outputs: [...prev.outputs.filter((o) => o.id !== output.id), output] } : prev));

  if (error) {
    return (
      <div className="pt-2">
        <Link href="/" className="text-sm text-muted">
          ← All saves
        </Link>
        <p className="mt-6 text-danger">{error}</p>
      </div>
    );
  }
  if (!item) return <LoadingSkeleton />;

  const recipe = item.outputs.find((o) => o.type === 'recipe');
  const explainer = item.outputs.find((o) => o.type === 'explainer');
  const diagram = item.outputs.find((o) => o.type === 'diagram');
  const whatIfs = item.outputs.filter((o) => o.type === 'whatif');

  return (
    <div className="pb-6">
      <ItemHero item={item} title={item.title} />

      {pending && <Working item={item} />}

      {item.status === 'failed' && (
        <div className="mt-6 rounded-3xl border border-line bg-surface p-6 text-center">
          <p aria-hidden className="text-4xl">
            😕
          </p>
          <p className="mt-2 text-lg font-bold">Couldn&apos;t read that one</p>
          {item.error && <p className="mt-1 text-sm text-muted">{item.error}</p>}
          <button onClick={retry} className="mt-4 rounded-xl bg-accent px-5 py-2.5 font-semibold text-on-accent">
            Try again
          </button>
        </div>
      )}

      {item.status === 'done' && (
        <>
          {explainer && (
            <WhatIfSection
              itemId={item.id}
              outputs={whatIfs}
              onAdded={addOutput}
              onAsk={(text) => setChatDraft((d) => ({ text, n: (d?.n ?? 0) + 1 }))}
            />
          )}

          <div className="mt-7">
            {recipe && (
              <RecipeCard
                recipe={recipe.content as unknown as Recipe}
                showTitle={false}
                saved={{ itemId: item.id, wantToCookAt: item.cook_list_at, cooks }}
              />
            )}
            {explainer && <ExplainerCard explainer={explainer.content as unknown as Explainer} />}
            {diagram?.file_url && (
              <section className="mt-7">
                <SectionLabel>The picture</SectionLabel>
                <DiagramCard src={diagram.file_url} caption={(diagram.content as unknown as Diagram).caption} />
              </section>
            )}
          </div>

          {explainer && <FrameworksSection itemId={item.id} />}
          {explainer && <Tools item={item} onOutput={putOutput} hasDiagram={Boolean(diagram)} playLessonId={playLessonId} />}
          <Feedback itemId={item.id} thumbs={thumbs} setThumbs={setThumbs} />
          <Similar itemId={item.id} />
          <CouncilCard itemId={item.id} />

          <section className="mt-8 rounded-3xl border border-line bg-surface p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <span aria-hidden>💬</span> Ask about this
            </h2>
            <Chat itemId={item.id} placeholder="e.g. what's the catch?" draft={chatDraft} />
          </section>
        </>
      )}
    </div>
  );
}

/** Progress while the job runs: it has the text once `raw_text` is in. */
function Working({ item }: { item: Item }) {
  const video = item.source === 'youtube' || item.source === 'tiktok';
  // The explainer's first lines land in `summary`; the scenario is known once it's classified.
  const stage = !item.raw_text ? 0 : item.summary && item.what_if ? 2 : 1;
  const steps = [video ? 'Watching the video' : 'Reading the page', item.kind === 'recipe' ? 'Writing your recipe card' : 'Writing your explainer'];
  if (item.what_if && item.kind !== 'recipe') steps.push('Thinking through what if…');
  return (
    <div className="mt-6 rounded-3xl border border-line bg-surface p-5">
      <p className="text-lg font-bold">Working on it…</p>
      <p className="mt-0.5 text-sm text-muted">Usually under a minute. You&apos;ll get a notification if they&apos;re on.</p>
      <ol className="mt-4 flex flex-col gap-3">
        {steps.map((label, i) => (
          <li key={label} className={`flex items-center gap-3 text-sm ${i > stage ? 'text-muted' : ''}`}>
            <span
              aria-hidden
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                i < stage ? 'bg-success text-on-accent' : i === stage ? 'bg-accent text-on-accent' : 'bg-line'
              }`}
            >
              {i < stage ? '✓' : i === stage ? <span className="h-2 w-2 animate-pulse rounded-full bg-on-accent motion-reduce:animate-none" /> : i + 1}
            </span>
            <span className={i === stage ? 'font-semibold' : ''}>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Re-explain simpler / deeper, draw a diagram, or play a 2-minute lesson (written when asked for). */
function Tools({
  item,
  onOutput,
  hasDiagram,
  playLessonId,
}: {
  item: Item;
  onOutput: OnOutput;
  hasDiagram: boolean;
  /** A lesson already written and not yet played, if any. */
  playLessonId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<ExplainMode | 'diagram' | 'lesson' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reExplain(mode: ExplainMode) {
    setBusy(mode);
    setError(null);
    try {
      const { explainer } = await api<{ explainer: Explainer }>(`/api/items/${item.id}/explain`, { body: { mode } });
      onOutput('explainer', explainer);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  async function drawDiagram() {
    setBusy('diagram');
    setError(null);
    try {
      const { diagram } = await api<{ diagram: { content: Diagram; fileUrl: string } }>(`/api/items/${item.id}/diagram`, {
        method: 'POST',
      });
      onOutput('diagram', diagram.content, diagram.fileUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  /** Opens the lesson that's ready, else writes one (in the chosen format, if any). */
  async function playLesson(template?: Template) {
    if (!template && playLessonId) {
      router.push(`/play/${playLessonId}`);
      return;
    }
    setBusy('lesson');
    setError(null);
    try {
      const { lessonId } = await api<{ lessonId: string }>('/api/lessons', { body: { itemId: item.id, template } });
      router.push(`/play/${lessonId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(null);
    }
  }

  const tiles: { key: ExplainMode | 'diagram' | 'lesson'; icon: string; label: string; working: string; run: () => void }[] = [
    { key: 'simpler', icon: '🐣', label: 'Simpler', working: 'Simplifying…', run: () => reExplain('simpler') },
    { key: 'deeper', icon: '🔬', label: 'Go deeper', working: 'Digging in…', run: () => reExplain('deeper') },
  ];
  if (!hasDiagram) tiles.push({ key: 'diagram', icon: '🗺️', label: 'Diagram', working: 'Drawing…', run: drawDiagram });
  tiles.push({ key: 'lesson', icon: '🎮', label: '2-min lesson', working: 'Writing it…', run: () => playLesson() });

  return (
    <section className="mt-8">
      <SectionLabel>Tools</SectionLabel>
      <div className={`mt-3 grid gap-2 ${tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {tiles.map((t) => (
          <button
            key={t.key}
            onClick={t.run}
            disabled={busy !== null}
            className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface px-2 py-3.5 disabled:opacity-50"
          >
            <span aria-hidden className={`text-2xl ${busy === t.key ? 'animate-bounce motion-reduce:animate-none' : ''}`}>
              {t.icon}
            </span>
            <span className="text-sm font-semibold">{busy === t.key ? t.working : t.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">Lesson as</span>
        {TEMPLATES.filter((t) => t !== 'spot_bug' || item.kind === 'tech').map((t) => (
          <button
            key={t}
            onClick={() => playLesson(t)}
            disabled={busy !== null}
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium disabled:opacity-50"
          >
            {TEMPLATE_LABEL[t]}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

function Feedback({ itemId, thumbs, setThumbs }: { itemId: string; thumbs: number; setThumbs: (v: number) => void }) {
  async function vote(value: 1 | -1) {
    const next = thumbs === value ? 0 : value;
    setThumbs(next);
    try {
      await api(`/api/items/${itemId}/thumbs`, { body: { value: next } });
    } catch {
      setThumbs(thumbs);
    }
  }
  const pill = 'flex h-10 w-12 items-center justify-center rounded-full border text-lg transition-colors';
  return (
    <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-2.5">
      <span className="text-sm font-medium">{thumbs ? 'Thanks — noted for next time' : 'Was this useful?'}</span>
      <div className="flex gap-2">
        <button
          aria-pressed={thumbs === 1}
          aria-label="Thumbs up"
          onClick={() => vote(1)}
          className={`${pill} ${thumbs === 1 ? 'border-success bg-success/15' : 'border-line'}`}
        >
          👍
        </button>
        <button
          aria-pressed={thumbs === -1}
          aria-label="Thumbs down"
          onClick={() => vote(-1)}
          className={`${pill} ${thumbs === -1 ? 'border-danger bg-danger/15' : 'border-line'}`}
        >
          👎
        </button>
      </div>
    </div>
  );
}

/** Other saves on the same idea, as a row of thumbnails (no AI call: chunk embeddings). */
function Similar({ itemId }: { itemId: string }) {
  const [items, setItems] = useState<SimilarItem[] | null>(null);
  useEffect(() => {
    api<{ items: SimilarItem[] }>(`/api/items/${itemId}/similar`).then(
      (r) => setItems(r.items),
      () => setItems([]),
    );
  }, [itemId]);
  if (!items?.length) return null;
  return (
    <section className="mt-8">
      <SectionLabel>From your saves</SectionLabel>
      <ul className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {items.map((s) => (
          <li key={s.id} className="w-32 shrink-0">
            <Link href={`/items/${s.id}`} className="block">
              <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-line">
                <Thumb item={s} />
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug">{s.title ?? s.url}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-label="Loading">
      <div className="-mx-4 -mt-6 h-[22rem] animate-pulse bg-line motion-reduce:animate-none" />
      <div className="mt-4 h-4 w-1/3 animate-pulse rounded bg-line motion-reduce:animate-none" />
      <div className="mt-3 h-7 w-5/6 animate-pulse rounded bg-line motion-reduce:animate-none" />
      <div className="mt-2 h-7 w-2/3 animate-pulse rounded bg-line motion-reduce:animate-none" />
      <div className="mt-6 h-20 animate-pulse rounded-3xl bg-line motion-reduce:animate-none" />
    </div>
  );
}
