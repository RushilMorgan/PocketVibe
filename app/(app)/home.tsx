'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/components/api';
import { EnablePush } from '@/components/enable-push';
import { timeAgo } from '@/components/time-ago';
import { KIND_LABEL, type Topic } from '@/components/types';
import type { ItemRow } from '@/lib/supabase/database.types';

const PAGE = 30;
const CHIPS = 8;

/** The feed: paste box, topic filter chips, saved items newest first. */
export function Home({ notice, initialTopic }: { notice?: string; initialTopic: string | null }) {
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState<string | null>(initialTopic);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (topicId: string | null, before?: string) => {
    const params = new URLSearchParams({ limit: String(PAGE) });
    if (topicId) params.set('topic', topicId);
    if (before) params.set('before', before);
    const { items: page } = await api<{ items: ItemRow[] }>(`/api/items?${params}`);
    setItems((prev) => (before && prev ? [...prev, ...page] : page));
    setHasMore(page.length === PAGE);
  }, []);

  useEffect(() => {
    setItems(null);
    load(topic).catch(() => setItems([]));
  }, [topic, load]);

  useEffect(() => {
    api<{ topics: Topic[] }>('/api/topics').then(
      (r) => setTopics(r.topics.filter((t) => t.itemCount > 0)),
      () => {},
    );
  }, []);

  // Refresh while anything is still being processed.
  const pending = items?.some((i) => i.status === 'queued' || i.status === 'processing');
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => load(topic).catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, [pending, topic, load]);

  function pickTopic(id: string | null) {
    setTopic(id);
    router.replace(id ? `/?topic=${id}` : '/', { scroll: false });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { item } = await api<{ item: ItemRow }>('/api/items', { body: { url } });
      router.push(`/items/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  }

  const chips = topics.slice(0, CHIPS);
  const selected = topics.find((t) => t.id === topic);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Your saves</h1>
      {notice && <p className="mt-4 rounded-lg bg-surface p-3 text-sm">{notice}</p>}

      <form onSubmit={save} className="mt-5 flex gap-2">
        <input
          type="url"
          required
          inputMode="url"
          placeholder="Paste a link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
        />
        <button disabled={saving} className="rounded-xl bg-accent px-4 py-3 font-medium text-on-accent disabled:opacity-60">
          Save
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <EnablePush />

      {chips.length > 0 && (
        <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={!topic} onClick={() => pickTopic(null)}>
            All
          </Chip>
          {chips.map((t) => (
            <Chip key={t.id} active={topic === t.id} onClick={() => pickTopic(t.id)}>
              {t.name}
            </Chip>
          ))}
          {selected && !chips.includes(selected) && <Chip active>{selected.name}</Chip>}
        </div>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {items === null && <li className="text-muted">Loading…</li>}
        {items?.map((item) => (
          <li key={item.id}>
            <FeedCard item={item} />
          </li>
        ))}
        {items?.length === 0 && (
          <li className="rounded-xl border border-dashed border-line p-6 text-center text-muted">
            {topic ? 'Nothing under this topic yet.' : 'Nothing saved yet. Share a link to HeyToolie from any app, or paste one above.'}
          </li>
        )}
      </ul>

      {hasMore && items && (
        <button
          onClick={() => load(topic, items.at(-1)!.created_at)}
          className="mt-4 w-full rounded-xl border border-line py-3 text-sm text-muted"
        >
          Load more
        </button>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'}`}
    >
      {children}
    </button>
  );
}

function FeedCard({ item }: { item: ItemRow }) {
  const working = item.status === 'queued' || item.status === 'processing';
  const firstLine = item.summary?.split('\n')[0];
  return (
    <Link href={`/items/${item.id}`} className="block rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{item.kind ? KIND_LABEL[item.kind] : working ? 'Working on it…' : '📎'}</span>
        <span>{timeAgo(item.created_at)}</span>
      </div>
      <p className="mt-1.5 font-medium leading-snug">{item.title ?? new URL(item.url).hostname}</p>
      {item.status === 'failed' && <p className="mt-1 text-sm text-danger">Couldn&apos;t read that one — tap to retry</p>}
      {item.status === 'done' && firstLine && <p className="mt-1 line-clamp-2 text-sm text-muted">{firstLine}</p>}
    </Link>
  );
}
