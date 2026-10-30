'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/components/api';
import { ExplainerCard } from '@/components/explainer-card';
import { RecipeCard } from '@/components/recipe-card';
import type { Explainer, Recipe } from '@/lib/handlers/schemas';
import type { ItemOutputRow, ItemRow } from '@/lib/supabase/database.types';

type Item = ItemRow & { outputs: ItemOutputRow[] };

const POLL_MS = 2500;

function Outputs({ item }: { item: Item }) {
  const recipe = item.outputs.find((o) => o.type === 'recipe');
  const explainer = item.outputs.find((o) => o.type === 'explainer');
  if (recipe) return <RecipeCard recipe={recipe.content as unknown as Recipe} />;
  return (
    <>
      <p className="text-sm uppercase tracking-wide text-muted">{item.kind}</p>
      <h1 className="mt-1 mb-4 text-xl font-semibold">{item.title}</h1>
      {explainer && <ExplainerCard explainer={explainer.content as unknown as Explainer} />}
    </>
  );
}

/**
 * Phase 1 shell: shows "Got it, working on it…" immediately, polls until the
 * job settles, offers Retry on failure, then renders the recipe or explainer.
 */
export function ItemView({ id }: { id: string }) {
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItem((await api<{ item: Item }>(`/api/items/${id}`)).item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div>
      <Link href="/" className="text-sm text-muted">
        ← All saves
      </Link>
      {error ? (
        <p className="mt-6 text-danger">{error}</p>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
          {pending && <p className="text-lg font-medium">Got it, working on it…</p>}
          {item?.status === 'failed' && (
            <>
              <p className="text-lg font-medium">Couldn&apos;t read that one</p>
              {item.error && <p className="mt-1 text-sm text-muted">{item.error}</p>}
              <button onClick={retry} className="mt-4 rounded-xl bg-accent px-4 py-2 font-medium text-white">
                Retry
              </button>
            </>
          )}
          {item?.status === 'done' && <Outputs item={item} />}
          {item && (
            <a href={item.url} target="_blank" rel="noreferrer" className="mt-4 block truncate text-sm text-accent">
              {item.url}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
