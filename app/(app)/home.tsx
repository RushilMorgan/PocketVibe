'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/components/api';
import { EnablePush } from '@/components/enable-push';
import { FeedCard } from '@/components/feed/feed-card';
import { SaveButton } from '@/components/feed/save-button';
import { StreakStrip } from '@/components/feed/streak-strip';
import { UpNext } from '@/components/feed/up-next';
import type { Feed, FeedFilter, FeedItem, Topic } from '@/components/types';

const PAGE = 30;
const TOPIC_CHIPS = 6;

/** One chip at a time: a smart filter, a topic, or neither (All). */
type Selection = { filter: FeedFilter | null; topic: string | null };

/** The saves feed (docs/saves-redesign.md Part A): streak, Up next, filter chips, image grid. */
export function Home({
  notice,
  initialTopic,
  initialFilter,
}: {
  notice?: string;
  initialTopic: string | null;
  initialFilter: FeedFilter | null;
}) {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sel, setSel] = useState<Selection>({ filter: initialFilter, topic: initialFilter ? null : initialTopic });
  const [digestId, setDigestId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (s: Selection, before?: string) => {
    const params = new URLSearchParams({ limit: String(PAGE) });
    if (s.filter) params.set('filter', s.filter);
    if (s.topic) params.set('topic', s.topic);
    if (before) params.set('before', before);
    const page = await api<Feed>(`/api/feed?${params}`);
    setFailed(false);
    if (before) {
      setItems((prev) => [...(prev ?? []), ...page.items]);
    } else {
      setFeed(page);
      setItems(page.items);
    }
    setHasMore(page.hasMore);
  }, []);

  useEffect(() => {
    setItems(null);
    load(sel).catch(() => {
      setItems([]);
      setFailed(true);
    });
  }, [sel, load]);

  useEffect(() => {
    api<{ id: string | null }>('/api/digests/latest').then((r) => setDigestId(r.id), () => {});
    api<{ topics: Topic[] }>('/api/topics').then((r) => setTopics(r.topics.filter((t) => t.itemCount > 0)), () => {});
  }, []);

  // Refresh while anything is still being processed, so cards flip to done by themselves.
  const pending = items?.some((i) => i.state === 'working');
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => load(sel).catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, [pending, sel, load]);

  function pick(next: Selection) {
    setSel(next);
    const q = next.filter ? `?filter=${next.filter}` : next.topic ? `?topic=${next.topic}` : '';
    router.replace(`/${q}`, { scroll: false });
  }

  async function snooze(id: string) {
    await api(`/api/items/${id}/snooze`, { method: 'POST' }).catch(() => {});
    await load(sel).catch(() => {});
  }

  const showAll = !sel.filter && !sel.topic;
  const topicChips = topics.slice(0, TOPIC_CHIPS);
  const selectedTopic = topics.find((t) => t.id === sel.topic);
  const nothingSaved = showAll && items?.length === 0 && !failed;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Your saves</h1>
        {feed && feed.counts.lesson > 0 && (
          <button onClick={() => pick({ filter: 'lesson', topic: null })} className="text-sm font-medium text-accent">
            {feed.counts.lesson} lesson{feed.counts.lesson === 1 ? '' : 's'} waiting
          </button>
        )}
      </header>

      {notice && <p className="rounded-xl bg-surface p-3 text-sm">{notice}</p>}

      {feed && !nothingSaved && <StreakStrip streak={feed.streak} week={feed.week} todayIndex={sastWeekday()} />}

      <EnablePush />

      {digestId && (
        <Link href={`/digest/${digestId}`} className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-3">
          <span aria-hidden className="text-xl">
            📬
          </span>
          <span className="text-sm">
            <span className="font-semibold">Your week is ready</span> — what you saved, new finds and a 2-minute lesson.
          </span>
        </Link>
      )}

      {showAll && feed?.upNext && (
        <UpNext item={feed.upNext.item} reason={feed.upNext.reason} onSnooze={() => snooze(feed.upNext!.item.id)} />
      )}

      {!nothingSaved && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip active={showAll} onClick={() => pick({ filter: null, topic: null })}>
            All
          </Chip>
          <Chip active={sel.filter === 'unread'} onClick={() => pick({ filter: 'unread', topic: null })} count={feed?.counts.unread}>
            To read
          </Chip>
          <Chip active={sel.filter === 'lesson'} onClick={() => pick({ filter: 'lesson', topic: null })} count={feed?.counts.lesson}>
            Lessons
          </Chip>
          <Chip active={sel.filter === 'recipe'} onClick={() => pick({ filter: 'recipe', topic: null })}>
            Recipes
          </Chip>
          {topicChips.map((t) => (
            <Chip key={t.id} active={sel.topic === t.id} onClick={() => pick({ filter: null, topic: t.id })}>
              <span className="capitalize">{t.name}</span>
            </Chip>
          ))}
          {selectedTopic && !topicChips.includes(selectedTopic) && (
            <Chip active>
              <span className="capitalize">{selectedTopic.name}</span>
            </Chip>
          )}
        </div>
      )}

      {items === null && <SkeletonGrid />}

      {items && items.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <FeedCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {failed && (
        <p className="rounded-2xl border border-line p-6 text-center text-sm text-muted">
          Couldn&apos;t load your saves.{' '}
          <button onClick={() => pick({ ...sel })} className="font-medium text-accent">
            Try again
          </button>
        </p>
      )}

      {nothingSaved && (
        <div className="rounded-3xl border border-dashed border-line p-8 text-center">
          <p aria-hidden className="text-5xl">
            📥
          </p>
          <h2 className="mt-3 text-lg font-bold">Share your first video</h2>
          <p className="mt-1 text-sm text-muted">
            In YouTube or TikTok tap Share → HeyToolie. You&apos;ll get the useful version back, plus a 2-minute lesson.
          </p>
        </div>
      )}

      {!showAll && items?.length === 0 && !failed && (
        <div className="rounded-3xl border border-dashed border-line p-8 text-center">
          <p className="font-semibold">Nothing here right now. Nice.</p>
          <button onClick={() => pick({ filter: null, topic: null })} className="mt-2 text-sm font-medium text-accent">
            Show all saves
          </button>
        </div>
      )}

      {hasMore && items && (
        <button
          onClick={() => load(sel, items.at(-1)!.created_at).catch(() => {})}
          className="w-full rounded-xl border border-line py-3 text-sm text-muted"
        >
          Load more
        </button>
      )}

      <SaveButton />
    </div>
  );
}

/** Monday = 0 in South African time, for the week dots. */
function sastWeekday(): number {
  return (new Date(Date.now() + 2 * 3600_000).getUTCDay() + 6) % 7;
}

function Chip({
  active,
  onClick,
  count,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-ink text-bg' : 'border border-line bg-surface'
      }`}
    >
      {children}
      {count ? <span className={`ml-1.5 ${active ? 'opacity-70' : 'text-muted'}`}>{count}</span> : null}
    </button>
  );
}

function SkeletonGrid() {
  return (
    <ul aria-label="Loading" className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i}>
          <div className="aspect-[4/5] animate-pulse rounded-2xl bg-line motion-reduce:animate-none" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-line motion-reduce:animate-none" />
          <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-line motion-reduce:animate-none" />
        </li>
      ))}
    </ul>
  );
}
