'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { ChatSource } from './types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
}

/**
 * Streaming chat box. With `itemId` it asks about one item; without, it asks
 * the whole library. The conversation is saved server-side and reloaded here,
 * so answers survive leaving the page. Citations like [2] link to the item.
 */
export function Chat({ itemId, placeholder, empty }: { itemId?: string; placeholder: string; empty?: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const thread = itemId ? `?itemId=${itemId}` : '';

  useEffect(() => {
    api<{ messages: Message[] }>(`/api/chat${thread}`).then(
      (r) => setMessages(r.messages),
      () => setMessages([]),
    );
  }, [thread]);

  async function clear() {
    if (!confirm('Clear this conversation?')) return;
    await api(`/api/chat${thread}`, { method: 'DELETE' });
    setMessages([]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setMessages((prev) => [...(prev ?? []), { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    abort.current = new AbortController();

    const update = (patch: Partial<Message>) =>
      setMessages((prev) => (prev ? [...prev.slice(0, -1), { ...prev.at(-1)!, ...patch }] : prev));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, question }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Something went wrong');
      }
      const sources = JSON.parse(decodeURIComponent(res.headers.get('X-Sources') ?? '%5B%5D')) as ChatSource[];
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let text = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += value;
        update({ content: text, sources });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') update({ content: `⚠️ ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {messages === null && <p className="text-sm text-muted">Loading the conversation…</p>}
      {messages?.length === 0 && empty}
      <ol className="flex flex-col gap-4">
        {messages?.map((m, i) =>
          m.role === 'user' ? (
            <li key={i} className="self-end rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-on-accent">
              {m.content}
            </li>
          ) : (
            <li key={i}>
              <Answer message={m} hideSources={Boolean(itemId)} />
            </li>
          ),
        )}
      </ol>
      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
        />
        <button disabled={busy || !input.trim()} className="rounded-xl bg-accent px-4 py-3 font-medium text-on-accent disabled:opacity-60">
          {busy ? '…' : 'Ask'}
        </button>
      </form>
      {!!messages?.length && !busy && (
        <button onClick={clear} className="mt-2 text-xs text-muted hover:text-danger">
          Clear chat
        </button>
      )}
    </div>
  );
}

function Answer({ message, hideSources }: { message: Message; hideSources: boolean }) {
  const sources = message.sources ?? [];
  const byN = new Map(sources.map((s) => [s.n, s]));
  const cited = new Set([...message.content.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  if (!message.content) return <p className="text-muted">Thinking…</p>;

  // On an item page there's only one source, so "[1]" is noise: drop it and the space before it.
  const text = hideSources ? message.content.replace(/\s*\[\d+\]/g, '') : message.content;

  return (
    <div>
      <p className="whitespace-pre-wrap leading-relaxed">
        {text.split(/(\[\d+\])/g).map((part, i) => {
          const source = byN.get(Number(part.match(/^\[(\d+)\]$/)?.[1]));
          if (!source) return part;
          return (
            <Link key={i} href={`/items/${source.itemId}`} className="mx-0.5 align-super text-xs font-semibold text-accent">
              {source.n}
            </Link>
          );
        })}
      </p>
      {!hideSources && cited.size > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-l-2 border-line pl-3 text-sm">
          {sources
            .filter((s) => cited.has(s.n))
            .map((s) => (
              <li key={s.n}>
                <Link href={`/items/${s.itemId}`} className="text-muted hover:text-accent">
                  {s.n}. {s.title}
                </Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
