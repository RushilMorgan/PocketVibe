'use client';

import { useEffect, useRef, useState } from 'react';
import { SectionLabel } from '@/components/explainer-card';
import type { Recipe } from '@/lib/handlers/schemas';

/**
 * A recipe you can cook from: stat tiles, an ingredient checklist, steps you
 * tap through (the next one is highlighted), and Cook mode, which keeps the
 * screen on. Ticks are per visit; nothing is saved.
 */
export function RecipeCard({ recipe, showTitle = true }: { recipe: Recipe; showTitle?: boolean }) {
  const [have, setHave] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());
  const current = recipe.steps.findIndex((_, i) => !done.has(i));

  const toggle = (set: Set<number>, i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  };

  return (
    <article>
      {showTitle && <h2 className="text-2xl font-extrabold tracking-tight">{recipe.title}</h2>}
      <p className={`${showTitle ? 'mt-1' : ''} leading-relaxed text-muted`}>{recipe.description}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat icon="👥" label="Serves" value={String(recipe.servings)} />
        <Stat icon="🔪" label="Prep" value={recipe.prepTime || '—'} />
        <Stat icon="🔥" label="Cook" value={recipe.cookTime || '—'} />
      </div>

      <CookMode />

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Ingredients · {recipe.ingredients.length}</SectionLabel>
          {have.size > 0 && (
            <span className="text-xs font-medium text-success">
              {have.size}/{recipe.ingredients.length} ready
            </span>
          )}
        </div>
        <ul className="mt-3 flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {recipe.ingredients.map((ing, i) => {
            const got = have.has(i);
            const amount = [ing.quantity, ing.unit].filter(Boolean).join(' ');
            return (
              <li key={i}>
                <button
                  onClick={() => setHave((s) => toggle(s, i))}
                  aria-pressed={got}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                >
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg text-lg">
                    {ing.emoji}
                  </span>
                  <span className={`min-w-0 flex-1 ${got ? 'text-muted line-through' : ''}`}>
                    {amount && <span className="font-semibold">{amount} </span>}
                    {ing.name}
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
      </section>

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Method · {recipe.steps.length} steps</SectionLabel>
          {done.size > 0 && (
            <button onClick={() => setDone(new Set())} className="text-xs font-medium text-accent">
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
                  onClick={() => setDone((s) => toggle(s, i))}
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
