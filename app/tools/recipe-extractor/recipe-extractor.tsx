'use client';

import { useState } from 'react';
import { api } from '@/components/api';
import { RecipeCard } from '@/components/recipe-card';
import type { Recipe } from '@/lib/handlers/schemas';

export function RecipeExtractor({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState('');
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setRecipe(null);
    try {
      const res = await api<{ recipe: Recipe }>('/api/tools/recipe', {
        body: { url: url.trim() || undefined, text: text.trim() || undefined },
      });
      setRecipe(res.recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="url"
          inputMode="url"
          placeholder="Paste a YouTube, TikTok or recipe-site link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
        />
        {showText ? (
          <textarea
            rows={6}
            placeholder="…or paste the recipe text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
          />
        ) : (
          <button type="button" onClick={() => setShowText(true)} className="self-start text-sm text-accent">
            Or paste recipe text instead
          </button>
        )}
        <button
          disabled={busy || (!url.trim() && !text.trim())}
          className="rounded-xl bg-accent px-4 py-3 font-medium text-on-accent disabled:opacity-60"
        >
          {busy ? 'Reading the recipe… (up to a minute for videos)' : 'Get the recipe'}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>

      {recipe && (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <RecipeCard recipe={recipe} />
        </div>
      )}
    </div>
  );
}
