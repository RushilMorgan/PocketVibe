'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/components/api';
import { shortAgo } from '@/components/feed/format';
import { Thumb } from '@/components/feed/thumb';
import { Stars } from '@/components/recipes/cooked-form';
import { parseHave, whatCanIMake } from '@/lib/recipes/scale';
import { formatMinutes, shownRecipes, topTags, type RecipeFilter, type RecipeSummary } from '@/lib/recipes/view';

const FILTERS: { key: RecipeFilter; label: string }[] = [
  { key: 'want', label: '🔖 Want to cook' },
  { key: 'quick', label: '⚡ 30 min or less' },
  { key: 'untried', label: 'Not tried yet' },
  { key: 'cooked', label: '✓ Cooked' },
];

/**
 * Every saved recipe in one place (docs/recipes.md): search by name, tag or
 * ingredient, filter by list, time and tag. The Want to cook list is on top.
 * "What can I make?" ranks them by the things you say you have.
 */
export function RecipesView() {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecipeFilter | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  /** null = normal browsing; a string = "What can I make?" with these things typed. */
  const [haveText, setHaveText] = useState<string | null>(null);

  useEffect(() => {
    api<{ recipes: RecipeSummary[] }>('/api/recipes').then(
      (r) => setRecipes(r.recipes),
      () => setFailed(true),
    );
  }, []);

  const tags = useMemo(() => topTags(recipes ?? []), [recipes]);
  const have = useMemo(() => parseHave(haveText ?? ''), [haveText]);
  const matches = useMemo(() => new Map(whatCanIMake(recipes ?? [], have).map((m) => [m.recipe.id, m])), [recipes, have]);
  const making = haveText !== null;
  const shown = useMemo(
    () => (making ? [...matches.values()].map((m) => m.recipe) : shownRecipes(recipes ?? [], { query, filter, tag })),
    [making, matches, recipes, query, filter, tag],
  );
  const count = (f: RecipeFilter) => shownRecipes(recipes ?? [], { filter: f }).length;

  async function toggleWant(recipe: RecipeSummary) {
    const on = recipe.wantToCookAt === null;
    const set = (wantToCookAt: string | null) =>
      setRecipes((list) => list?.map((r) => (r.id === recipe.id ? { ...r, wantToCookAt } : r)) ?? list);
    set(on ? new Date().toISOString() : null);
    try {
      await api(`/api/recipes/${recipe.id}/want`, { body: { on } });
    } catch {
      set(recipe.wantToCookAt);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link href="/" className="text-sm text-muted">
          ← All saves
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Recipes</h1>
      </header>

      {failed && <p className="rounded-2xl border border-line p-6 text-center text-sm text-muted">Couldn&apos;t load your recipes. Pull down to try again.</p>}
      {recipes === null && !failed && <p className="text-muted">Loading…</p>}

      {recipes && recipes.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line p-8 text-center">
          <p aria-hidden className="text-5xl">
            🍳
          </p>
          <h2 className="mt-3 text-lg font-bold">No recipes yet</h2>
          <p className="mt-1 text-sm text-muted">Share a cooking video or recipe page to HeyToolie and it turns up here as a recipe you can cook from.</p>
        </div>
      )}

      {recipes && recipes.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-line/60 p-1 text-sm font-medium">
            <button onClick={() => setHaveText(null)} aria-pressed={!making} className={`rounded-lg py-2 ${!making ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              Browse
            </button>
            <button onClick={() => setHaveText(haveText ?? '')} aria-pressed={making} className={`rounded-lg py-2 ${making ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              🧺 What can I make?
            </button>
          </div>

          {making ? (
            <div>
              <input
                value={haveText}
                onChange={(e) => setHaveText(e.target.value)}
                placeholder="What do you have? e.g. chicken, rice, garlic"
                aria-label="What you have"
                autoFocus
                className="w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
              />
              <p className="mt-1.5 text-xs text-muted">Separate things with commas. Recipes that use the most of them come first.</p>
            </div>
          ) : (
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes or ingredients, e.g. chicken"
                aria-label="Search recipes"
                className="rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
              />

              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                <Chip active={!filter && !tag} onClick={() => (setFilter(null), setTag(null))}>
                  All <Count n={recipes.length} />
                </Chip>
                {FILTERS.filter((f) => count(f.key) > 0).map((f) => (
                  <Chip key={f.key} active={filter === f.key} onClick={() => (setFilter(filter === f.key ? null : f.key), setTag(null))}>
                    {f.label} <Count n={count(f.key)} />
                  </Chip>
                ))}
                {tags.map((t) => (
                  <Chip key={t} active={tag === t} onClick={() => (setTag(tag === t ? null : t), setFilter(null))}>
                    #{t}
                  </Chip>
                ))}
              </div>
            </>
          )}

          {making && have.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-muted">Type a few things you have in the kitchen.</p>
          ) : shown.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line p-8 text-center">
              <p className="font-semibold">{making ? 'None of your recipes use those.' : 'Nothing matches.'}</p>
              <button onClick={() => (setQuery(''), setFilter(null), setTag(null), setHaveText(null))} className="mt-2 text-sm font-medium text-accent">
                Show all recipes
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((r) => (
                <li key={r.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-2.5">
                  <Link href={`/items/${r.id}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-line">
                    <Thumb item={{ ...r, kind: 'recipe' }} compact />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/items/${r.id}`} className="min-w-0">
                      <span className="line-clamp-2 font-semibold leading-snug">{r.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {[r.totalMinutes !== null ? formatMinutes(r.totalMinutes) : null, `${r.ingredientCount} ingredients`, `serves ${r.servings}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </Link>
                    {making && matches.get(r.id) && (
                      <p className="mt-0.5 text-xs font-medium text-accent">
                        Uses {matches.get(r.id)!.matched.join(', ')}
                        <span className="font-normal text-muted">
                          {matches.get(r.id)!.missing === 0 ? ' · nothing else needed' : ` · ${matches.get(r.id)!.missing} more to get`}
                        </span>
                      </p>
                    )}
                    <p className="mt-0.5 truncate text-xs">
                      {r.cookedCount > 0 ? (
                        <span className="font-medium text-success">
                          ✓ Cooked{r.cookedCount > 1 ? ` ${r.cookedCount}×` : ''}
                          {r.lastCookedAt && ` · ${shortAgo(r.lastCookedAt)} ago`}
                          {r.rating !== null && (
                            <>
                              {' · '}
                              <Stars rating={r.rating} />
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted">Saved {shortAgo(r.created_at)} ago</span>
                      )}
                    </p>
                    <div className="mt-auto flex gap-2 pt-2">
                      <Link href={`/cook/${r.id}`} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent">
                        👩‍🍳 Cook
                      </Link>
                      <button
                        onClick={() => toggleWant(r)}
                        aria-pressed={r.wantToCookAt !== null}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          r.wantToCookAt !== null ? 'border-accent bg-accent/10 text-accent' : 'border-line'
                        }`}
                      >
                        {r.wantToCookAt !== null ? '🔖 On your list' : '🔖 Want to cook'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${active ? 'bg-ink text-bg' : 'border border-line bg-surface'}`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 opacity-60">{n}</span>;
}
