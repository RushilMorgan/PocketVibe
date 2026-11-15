'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/api';
import { SectionLabel } from '@/components/explainer-card';
import { shortAgo } from '@/components/feed/format';
import { CookedForm, Stars } from '@/components/recipes/cooked-form';
import { toggled, useCookProgress } from '@/components/recipes/use-cook-progress';
import type { Recipe } from '@/lib/handlers/schemas';
import { ingredientGroups, maxServings, shoppingList } from '@/lib/recipes/scale';
import type { Cook } from '@/lib/recipes/view';

/** What a saved recipe adds to the card: the cooking view, the Want to cook list and the cooked log. */
export interface SavedRecipe {
  itemId: string;
  wantToCookAt: string | null;
  cooks: Cook[];
}

/**
 * A recipe you can cook from: stat tiles with a servings stepper that rescales
 * the amounts, an ingredient checklist (in the recipe's parts, when it has
 * them) with a copyable shopping list, and steps you tap through (the next
 * one is highlighted). A saved recipe (`saved`) also gets
 * Start cooking (the step-by-step view), Want to cook, and "I cooked this" with
 * your last note; its ticks are remembered on this device for the sitting.
 * Without `saved` (the standalone tool) there's a Cook mode toggle instead.
 */
export function RecipeCard({ recipe, showTitle = true, saved }: { recipe: Recipe; showTitle?: boolean; saved?: SavedRecipe }) {
  const [progress, update] = useCookProgress(saved?.itemId ?? null);
  const have = new Set(progress.have);
  const done = new Set(progress.done);
  const current = recipe.steps.findIndex((_, i) => !done.has(i));
  const servings = progress.servings ?? recipe.servings;
  const factor = servings / recipe.servings;
  const groups = ingredientGroups(recipe, factor);
  const [copied, setCopied] = useState(false);

  async function copyList() {
    try {
      await navigator.clipboard.writeText(shoppingList(recipe, { factor, servings, have: progress.have }));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article>
      {showTitle && <h2 className="text-2xl font-extrabold tracking-tight">{recipe.title}</h2>}
      <p className={`${showTitle ? 'mt-1' : ''} leading-relaxed text-muted`}>{recipe.description}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-line bg-surface px-1 py-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => update({ servings: servings - 1 })}
              disabled={servings <= 1}
              aria-label="Fewer servings"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-lg font-bold disabled:opacity-30"
            >
              −
            </button>
            <span className="w-7 text-lg font-extrabold tabular-nums" aria-live="polite">
              {servings}
            </span>
            <button
              onClick={() => update({ servings: servings + 1 })}
              disabled={servings >= maxServings(recipe.servings)}
              aria-label="More servings"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-lg font-bold disabled:opacity-30"
            >
              +
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">{factor === 1 ? 'Serves' : `Serves · was ${recipe.servings}`}</p>
        </div>
        <Stat icon="🔪" label="Prep" value={recipe.prepTime || '—'} />
        <Stat icon="🔥" label="Cook" value={recipe.cookTime || '—'} />
      </div>

      {saved ? <SavedActions saved={saved} started={progress.screen > 0 || progress.done.length > 0} /> : <CookMode />}

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Ingredients · {recipe.ingredients.length}</SectionLabel>
          {have.size > 0 && (
            <span className="text-xs font-medium text-success">
              {have.size}/{recipe.ingredients.length} ready
            </span>
          )}
        </div>
        {groups.map((group) => (
          <div key={group.name ?? 'all'}>
            {group.name && <p className="mt-4 text-sm font-bold">{group.name}</p>}
            <ul className={`${group.name ? 'mt-2' : 'mt-3'} flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface`}>
              {group.lines.map((line) => {
                const got = have.has(line.index);
                return (
                  <li key={line.index}>
                    <button
                      onClick={() => update({ have: toggled(progress.have, line.index) })}
                      aria-pressed={got}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                    >
                      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg text-lg">
                        {line.emoji}
                      </span>
                      <span className={`min-w-0 flex-1 ${got ? 'text-muted line-through' : ''}`}>
                        {line.amount && <span className="font-semibold">{line.amount} </span>}
                        {line.name}
                      </span>
                      <span
                        aria-hidden
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                          got ? 'bg-success text-on-accent' : 'border-2 border-line'
                        }`}
                      >
                        {got ? '✓' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <button onClick={copyList} className="mt-3 w-full rounded-xl border border-line bg-surface py-2.5 text-sm font-medium">
          {copied ? '✓ Copied. Paste it into your notes' : have.size > 0 ? '📋 Copy shopping list (what you still need)' : '📋 Copy shopping list'}
        </button>
      </section>

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Method · {recipe.steps.length} steps</SectionLabel>
          {done.size > 0 && (
            <button onClick={() => update({ done: [], screen: 0 })} className="text-xs font-medium text-accent">
              Start over
            </button>
          )}
        </div>
        <ol className="mt-3 flex flex-col gap-2.5">
          {recipe.steps.map((step, i) => {
            const finished = done.has(i);
            const isCurrent = i === current;
            return (
              <li key={i}>
                <button
                  onClick={() => update({ done: toggled(progress.done, i) })}
                  aria-pressed={finished}
                  className={`flex w-full gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                    isCurrent ? 'border-accent bg-accent/10' : 'border-line bg-surface'
                  } ${finished ? 'opacity-55' : ''}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      finished ? 'bg-success text-on-accent' : isCurrent ? 'bg-accent text-on-accent' : 'bg-line'
                    }`}
                  >
                    {finished ? '✓' : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block leading-relaxed ${finished ? 'line-through' : ''}`}>
                      {step.emoji && <span aria-hidden>{step.emoji} </span>}
                      {step.text}
                    </span>
                    {step.time && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-muted">
                        ⏱ {step.time}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {current === -1 && (
          <p className="mt-4 rounded-2xl bg-success/10 p-4 text-center font-semibold text-success">🎉 All done. Enjoy!</p>
        )}
      </section>

      {recipe.tags.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-1.5">
          {recipe.tags.map((t) => (
            <li key={t} className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted ring-1 ring-line">
              #{t}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** Start cooking, Want to cook, I cooked this, and what you said last time. */
function SavedActions({ saved, started }: { saved: SavedRecipe; started: boolean }) {
  const [want, setWant] = useState(saved.wantToCookAt !== null);
  const [cooks, setCooks] = useState(saved.cooks);
  const [logging, setLogging] = useState(false);
  const last = cooks[0];

  async function toggleWant() {
    const next = !want;
    setWant(next);
    try {
      await api(`/api/recipes/${saved.itemId}/want`, { body: { on: next } });
    } catch {
      setWant(!next);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <Link
        href={`/cook/${saved.itemId}`}
        className="flex items-center gap-4 rounded-3xl bg-accent p-4 text-on-accent shadow-lg shadow-accent/25 active:scale-[0.99]"
      >
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-on-accent/15 text-2xl">
          👩‍🍳
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold leading-tight">{started ? 'Carry on cooking' : 'Start cooking'}</span>
          <span className="mt-0.5 block text-sm opacity-85">One step at a time, with timers. The screen stays on.</span>
        </span>
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={toggleWant}
          aria-pressed={want}
          className={`rounded-xl border py-2.5 text-sm font-medium ${want ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface'}`}
        >
          {want ? '🔖 On your list' : '🔖 Want to cook'}
        </button>
        <button onClick={() => setLogging((v) => !v)} aria-expanded={logging} className="rounded-xl border border-line bg-surface py-2.5 text-sm font-medium">
          ✓ I cooked this
        </button>
      </div>

      {logging && (
        <CookedForm
          itemId={saved.itemId}
          onCancel={() => setLogging(false)}
          onSaved={(cook) => {
            setCooks((c) => [cook, ...c]);
            setWant(false);
            setLogging(false);
          }}
        />
      )}

      {last && (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-3.5">
          <p className="text-sm font-bold text-success">
            Cooked {cooks.length === 1 ? 'once' : `${cooks.length} times`} · last {shortAgo(last.created_at) === 'now' ? 'just now' : `${shortAgo(last.created_at)} ago`}
            {last.rating !== null && (
              <>
                {' · '}
                <Stars rating={last.rating} />
              </>
            )}
          </p>
          {last.note && <p className="mt-1 leading-relaxed">“{last.note}”</p>}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-2 py-3 text-center">
      <span aria-hidden className="text-xl">
        {icon}
      </span>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

/** Keeps the screen awake while cooking (Screen Wake Lock API). Hidden where unsupported. */
function CookMode() {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setSupported('wakeLock' in navigator);
    return () => {
      lock.current?.release().catch(() => {});
    };
  }, []);

  // The browser drops the lock when the tab is hidden; take it again on return.
  useEffect(() => {
    if (!on) return;
    const reacquire = async () => {
      if (document.visibilityState === 'visible' && !lock.current) {
        lock.current = await navigator.wakeLock.request('screen').catch(() => null);
        lock.current?.addEventListener('release', () => (lock.current = null));
      }
    };
    document.addEventListener('visibilitychange', reacquire);
    return () => document.removeEventListener('visibilitychange', reacquire);
  }, [on]);

  async function toggle() {
    if (on) {
      await lock.current?.release().catch(() => {});
      lock.current = null;
      setOn(false);
      return;
    }
    try {
      lock.current = await navigator.wakeLock.request('screen');
      lock.current.addEventListener('release', () => (lock.current = null));
      setOn(true);
    } catch {
      setOn(false);
    }
  }

  if (!supported) return null;
  return (
    <button
      onClick={toggle}
      aria-pressed={on}
      className={`mt-3 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
        on ? 'border-warm bg-warm/10' : 'border-line bg-surface'
      }`}
    >
      <span>
        <span className="block text-sm font-bold">👩‍🍳 Cook mode</span>
        <span className="block text-xs text-muted">{on ? 'Screen stays on while you cook' : 'Keep the screen on while you cook'}</span>
      </span>
      <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-warm' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
