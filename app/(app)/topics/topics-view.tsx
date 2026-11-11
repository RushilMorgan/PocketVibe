'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/components/api';
import { Thumb } from '@/components/feed/thumb';
import { timeAgo } from '@/components/time-ago';
import { KIND_LABEL } from '@/components/types';
import type { TopicsPage } from '@/lib/topics';
import { displayTopic, type KindShare, type TopicView } from '@/lib/topic-view';

const MIX_COLOR: Record<KindShare['kind'], string> = {
  tech: 'bg-tile-tech',
  recipe: 'bg-tile-recipe',
  news: 'bg-tile-news',
  other: 'bg-tile-other',
};

/**
 * "What you're into": your mix of saves, the top 5 topics that shape every
 * explanation (as cards with their saves), and every topic grouped into
 * themes. Tap a topic for its saves and to rename, merge or forget it.
 */
export function TopicsView() {
  const [page, setPage] = useState<TopicsPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPage(await api<TopicsPage>('/api/topics?view=page'));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(() => new Map(page?.topics.map((t) => [t.id, t]) ?? []), [page]);
  const open = openId ? byId.get(openId) : undefined;
  const top = page?.topics.filter((t) => t.top) ?? [];
  const fresh = page?.topics.filter((t) => t.trend === 'new') ?? [];
  const maxWeight = Math.max(1, ...(page?.topics.map((t) => t.weight) ?? [1]));

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">What you&apos;re into</h1>
        <p className="mt-1 text-sm text-muted">Built from what you save. Your top {top.length || 5} shape every explanation.</p>
      </header>

      {failed && (
        <p className="rounded-2xl border border-line p-6 text-center text-sm text-muted">
          Couldn&apos;t load your topics.{' '}
          <button onClick={load} className="font-medium text-accent">
            Try again
          </button>
        </p>
      )}
      {!page && !failed && <Skeleton />}

      {page && page.topics.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line p-8 text-center">
          <p aria-hidden className="text-5xl">
            🧭
          </p>
          <h2 className="mt-3 text-lg font-bold">Your interests will show up here</h2>
          <p className="mt-1 text-sm text-muted">Every save adds to them. Share a few videos and come back.</p>
        </div>
      )}

      {page && page.topics.length > 0 && (
        <>
          {page.mix.length > 0 && <Mix mix={page.mix} />}

          <section>
            <SectionLabel>Shaping your explanations</SectionLabel>
            <ol className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {top.map((t, i) => (
                <li key={t.id} className="w-40 shrink-0">
                  <button onClick={() => setOpenId(t.id)} className="block w-full text-left">
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-line">
                      <Collage topic={t} />
                      <span className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm font-extrabold text-white backdrop-blur-sm">
                        {i + 1}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 font-bold leading-tight">{displayTopic(t.name)}</p>
                    <p className="text-xs text-muted">
                      {t.itemCount} {t.itemCount === 1 ? 'save' : 'saves'}
                    </p>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {fresh.length > 0 && (
            <section>
              <SectionLabel>New this week</SectionLabel>
              <div className="mt-3 flex flex-wrap gap-2">
                {fresh.slice(0, 8).map((t) => (
                  <TopicChip key={t.id} topic={t} maxWeight={maxWeight} onOpen={setOpenId} />
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionLabel>{page.themes ? 'By theme' : 'All topics'}</SectionLabel>
            <div className="mt-3 flex flex-col gap-3">
              {(page.themes ?? [{ name: 'Everything', emoji: '🧭', topicIds: page.topics.map((t) => t.id) }]).map((theme) => {
                const topics = theme.topicIds.flatMap((id) => byId.get(id) ?? []);
                if (!topics.length) return null;
                const saves = topics.reduce((n, t) => n + t.itemCount, 0);
                return (
                  <article key={theme.name} className="rounded-3xl border border-line bg-surface p-4">
                    <header className="flex items-center gap-3">
                      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg text-2xl">
                        {theme.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold leading-tight">{theme.name}</h2>
                        <p className="text-xs text-muted">
                          {topics.length} {topics.length === 1 ? 'topic' : 'topics'} · {saves} {saves === 1 ? 'save' : 'saves'}
                        </p>
                      </div>
                    </header>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {topics.map((t) => (
                        <TopicChip key={t.id} topic={t} maxWeight={maxWeight} onOpen={setOpenId} />
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <details className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold">How this works</summary>
            <p className="mt-2 text-muted">
              Every save adds 1 to its topics, 👍 adds 2, 👎 takes 2, playing a lesson adds 1, and everything fades 10% a
              week. Your top 5 are passed to every explanation, lesson and chat answer so they fit what you&apos;re into.
              Rename, merge or forget a topic by tapping it.
            </p>
          </details>
        </>
      )}

      {open && page && (
        <TopicSheet
          topic={open}
          others={page.topics.filter((t) => t.id !== open.id)}
          onClose={() => setOpenId(null)}
          onChanged={async () => {
            setOpenId(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{children}</h2>;
}

/** What you save, by kind, as one stacked bar. */
function Mix({ mix }: { mix: KindShare[] }) {
  return (
    <section>
      <SectionLabel>Your mix</SectionLabel>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-line">
        {mix.map((m) => (
          <span key={m.kind} className={MIX_COLOR[m.kind]} style={{ width: `${m.percent}%` }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {mix.map((m) => (
          <li key={m.kind} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${MIX_COLOR[m.kind]}`} />
            <span className="font-medium">{KIND_LABEL[m.kind].replace(/^\S+\s/, '')}</span>
            <span className="text-muted">{m.percent}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Up to four of the topic's saves as a 2×2 grid (one save fills the square). */
function Collage({ topic }: { topic: TopicView }) {
  const saves = topic.saves.slice(0, 4);
  if (saves.length <= 1) {
    return saves[0] ? <Thumb item={saves[0]} position="50% 30%" /> : <div className="h-full w-full bg-tile-other" />;
  }
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
      {[0, 1, 2, 3].map((i) =>
        saves[i] ? (
          <div key={i} className="overflow-hidden">
            <Thumb item={saves[i]} position="50% 30%" compact />
          </div>
        ) : (
          <div key={i} className="bg-bg" />
        ),
      )}
    </div>
  );
}

/** A topic as a chip: bigger when stronger, filled when it's in the top 5, quieter when fading. */
function TopicChip({ topic, maxWeight, onOpen }: { topic: TopicView; maxWeight: number; onOpen: (id: string) => void }) {
  const strength = topic.weight / maxWeight;
  const size = strength > 0.6 ? 'text-base px-3.5 py-2' : strength > 0.3 ? 'text-sm px-3 py-1.5' : 'text-[13px] px-2.5 py-1';
  const look = topic.top
    ? 'bg-accent text-on-accent font-semibold'
    : topic.trend === 'fading'
      ? 'border border-dashed border-line text-muted'
      : 'bg-bg ring-1 ring-line';
  return (
    <button onClick={() => onOpen(topic.id)} className={`rounded-full ${size} ${look}`}>
      {displayTopic(topic.name)}
      {topic.trend === 'new' && !topic.top && <span className="ml-1.5 text-[10px] font-bold uppercase text-accent">new</span>}
      {topic.itemCount > 1 && <span className={`ml-1.5 text-xs ${topic.top ? 'opacity-80' : 'text-muted'}`}>{topic.itemCount}</span>}
    </button>
  );
}

type Mode = 'view' | 'rename' | 'merge';

/** One topic: its saves, and rename / merge into another / forget. */
function TopicSheet({
  topic,
  others,
  onClose,
  onChanged,
}: {
  topic: TopicView;
  others: TopicView[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>('view');
  const [name, setName] = useState(topic.name);
  const [into, setInto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  const forget = () => {
    if (!confirm(`Forget "${displayTopic(topic.name)}"? Your saves stay; they just won't be filed under it.`)) return;
    run(() => api(`/api/topics/${topic.id}`, { method: 'DELETE' }));
  };
  const target = others.find((t) => t.id === into);
  const sorted = [...others].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={onClose}>
      <div
        role="dialog"
        aria-label={displayTopic(topic.name)}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="flex flex-wrap items-center gap-1.5">
          {topic.top && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">Top 5</span>}
          {topic.trend === 'new' && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">New this week</span>}
          {topic.trend === 'fading' && <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-muted">Fading</span>}
        </div>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight">{displayTopic(topic.name)}</h2>
        <p className="mt-1 text-sm text-muted">
          {topic.itemCount} {topic.itemCount === 1 ? 'save' : 'saves'} · last added {timeAgo(topic.lastSeenAt)} · strength{' '}
          {topic.weight}
        </p>

        {topic.saves.length > 0 && (
          <ul className="-mx-4 mt-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {topic.saves.map((s) => (
              <li key={s.id} className="w-24 shrink-0">
                <Link href={`/items/${s.id}`} className="block">
                  <div className="aspect-[4/5] overflow-hidden rounded-xl bg-line">
                    <Thumb item={s} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug">{s.title ?? s.url}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {mode === 'view' && (
          <div className="mt-5 flex flex-col gap-2">
            <Link href={`/?topic=${topic.id}`} className="rounded-2xl bg-accent py-3 text-center font-bold text-on-accent">
              See all {topic.itemCount} {topic.itemCount === 1 ? 'save' : 'saves'} →
            </Link>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setMode('rename')} className="rounded-2xl border border-line py-2.5 text-sm font-semibold">
                ✏️ Rename
              </button>
              <button
                onClick={() => setMode('merge')}
                disabled={others.length === 0}
                className="rounded-2xl border border-line py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                🔀 Merge
              </button>
              <button onClick={forget} disabled={busy} className="rounded-2xl border border-danger/40 py-2.5 text-sm font-semibold text-danger">
                Forget
              </button>
            </div>
          </div>
        )}

        {mode === 'rename' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api(`/api/topics/${topic.id}`, { method: 'PATCH', body: { name } }));
            }}
            className="mt-5 flex flex-col gap-2"
          >
            <input
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode('view')} className="rounded-2xl border border-line py-2.5 font-semibold">
                Cancel
              </button>
              <button disabled={busy || !name.trim()} className="rounded-2xl bg-accent py-2.5 font-bold text-on-accent disabled:opacity-60">
                {busy ? 'Saving…' : 'Save name'}
              </button>
            </div>
          </form>
        )}

        {mode === 'merge' && (
          <div className="mt-5 flex flex-col gap-2">
            <p className="text-sm text-muted">
              Fold <span className="font-semibold text-ink">{displayTopic(topic.name)}</span> into another topic. Its saves move
              over and its strength is added on.
            </p>
            <select
              value={into}
              onChange={(e) => setInto(e.target.value)}
              className="rounded-xl border border-line bg-bg px-3 py-3"
            >
              <option value="">Choose a topic…</option>
              {sorted.map((t) => (
                <option key={t.id} value={t.id}>
                  {displayTopic(t.name)} ({t.itemCount})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode('view')} className="rounded-2xl border border-line py-2.5 font-semibold">
                Cancel
              </button>
              <button
                onClick={() => target && run(() => api(`/api/topics/${topic.id}/merge`, { body: { into: target.id } }))}
                disabled={busy || !target}
                className="rounded-2xl bg-accent py-2.5 font-bold text-on-accent disabled:opacity-60"
              >
                {busy ? 'Merging…' : target ? `Merge into ${target.name}` : 'Merge'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-label="Loading" className="flex flex-col gap-4">
      <div className="h-3 animate-pulse rounded-full bg-line motion-reduce:animate-none" />
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-square w-40 shrink-0 animate-pulse rounded-2xl bg-line motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-3xl bg-line motion-reduce:animate-none" />
    </div>
  );
}
