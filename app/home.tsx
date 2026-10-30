'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/components/api';
import { EnablePush } from '@/components/enable-push';
import type { ItemRow } from '@/lib/supabase/database.types';

/** Phase 1 shell: paste box + plain list. The real feed lands in a later step. */
export function Home({ notice }: { notice?: string }) {
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[] | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: ItemRow[] }>('/api/items').then(
      (r) => setItems(r.items),
      () => setItems([]),
    );
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { item } = await api<{ item: ItemRow }>('/api/items', { body: { url } });
      router.push(`/items/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">HeyToolie</h1>
      {notice && <p className="mt-4 rounded-lg bg-surface p-3 text-sm">{notice}</p>}

      <form onSubmit={save} className="mt-6 flex gap-2">
        <input
          type="url"
          required
          inputMode="url"
          placeholder="Paste a link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
        />
        <button className="rounded-xl bg-accent px-4 py-3 font-medium text-white">Save</button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <EnablePush />

      <ul className="mt-8 flex flex-col gap-2">
        {items?.map((item) => (
          <li key={item.id}>
            <Link href={`/items/${item.id}`} className="block rounded-xl border border-line bg-surface p-4">
              <p className="font-medium">{item.title ?? item.url}</p>
              <p className="mt-1 text-sm text-muted">
                {item.kind ?? item.source} · {item.status}
              </p>
            </Link>
          </li>
        ))}
        {items?.length === 0 && <li className="text-muted">Nothing saved yet. Share a link to HeyToolie from any app.</li>}
      </ul>
    </div>
  );
}
