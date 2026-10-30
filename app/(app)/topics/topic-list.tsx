'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/components/api';
import type { Topic } from '@/components/types';

/** How many topics feed into prompts as "what this user is into". */
const TOP_N = 5;

export function TopicList() {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setTopics((await api<{ topics: Topic[] }>('/api/topics')).topics);
  }, []);

  useEffect(() => {
    load().catch(() => setTopics([]));
  }, [load]);

  async function rename(id: string) {
    setError(null);
    try {
      await api(`/api/topics/${id}`, { method: 'PATCH', body: { name: draft } });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function forget(topic: Topic) {
    if (!confirm(`Forget "${topic.name}"? Your saves stay; they just won't be filed under it.`)) return;
    setError(null);
    try {
      await api(`/api/topics/${topic.id}`, { method: 'DELETE' });
      setTopics((prev) => prev?.filter((t) => t.id !== topic.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (topics === null) return <p className="mt-6 text-muted">Loading…</p>;
  if (topics.length === 0) {
    return <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-muted">No topics yet — they appear as you save things.</p>;
  }

  const max = Math.max(...topics.map((t) => t.weight), 1);
  return (
    <div className="mt-6">
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <ol className="flex flex-col gap-2">
        {topics.map((t, i) => (
          <li key={t.id} className="rounded-xl border border-line bg-surface p-3">
            {editing === t.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  rename(t.id);
                }}
                className="flex gap-2"
              >
                <input
                  autoFocus
                  value={draft}
                  maxLength={40}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 outline-none focus:border-accent"
                />
                <button className="rounded-lg bg-accent px-3 text-sm text-white">Save</button>
                <button type="button" onClick={() => setEditing(null)} className="px-2 text-sm text-muted">
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/?topic=${t.id}`} className="font-medium">
                    {t.name}
                    {i < TOP_N && t.weight > 0 && <span className="ml-2 text-xs font-normal text-accent">top {TOP_N}</span>}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {t.itemCount} {t.itemCount === 1 ? 'save' : 'saves'} · {t.weight}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-bg">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, (t.weight / max) * 100)}%` }} />
                </div>
                <div className="mt-2 flex gap-4 text-xs">
                  <button
                    onClick={() => {
                      setEditing(t.id);
                      setDraft(t.name);
                    }}
                    className="text-muted hover:text-ink"
                  >
                    Rename
                  </button>
                  <button onClick={() => forget(t)} className="text-muted hover:text-danger">
                    Forget
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
