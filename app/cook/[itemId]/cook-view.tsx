'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/api';
import { CookedForm } from '@/components/recipes/cooked-form';
import { toggled, useCookProgress } from '@/components/recipes/use-cook-progress';
import type { Item } from '@/components/types';
import type { Recipe } from '@/lib/handlers/schemas';
import { formatClock, parseSeconds, stepIngredients } from '@/lib/recipes/view';

/**
 * Cooking view (docs/recipes.md): the ingredients, then one step per screen
 * in large type with the ingredients it uses, tap-to-start timers, and "I
 * cooked this" at the end. The screen stays on, and your place and running
 * timers survive a locked screen or a switch of apps.
 */
export function CookView({ itemId }: { itemId: string }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, update, reset] = useCookProgress(itemId);
  const [saved, setSaved] = useState(false);
  const now = useNow(Object.keys(progress.timers).length > 0);

  useEffect(() => {
    api<{ item: Item }>(`/api/items/${itemId}`).then(
      ({ item }) => {
        const card = item.outputs.find((o) => o.type === 'recipe');
        if (!card) return setError("This save isn't a recipe.");
        setRecipe(card.content as unknown as Recipe);
        setTitle(item.title ?? '');
      },
      (err) => setError(err instanceof Error ? err.message : 'Something went wrong'),
    );
  }, [itemId]);

  useWakeLock();
  const alarm = useAlarm();

  // Ring once when a timer runs out; it stays on screen until dismissed.
  const rung = useRef(new Set<string>());
  useEffect(() => {
    for (const [step, endsAt] of Object.entries(progress.timers)) {
      const id = `${step}:${endsAt}`;
      if (endsAt <= now && !rung.current.has(id)) {
        rung.current.add(id);
        alarm.ring();
      }
    }
  }, [now, progress.timers, alarm]);

  if (error) {
    return (
      <div className="pt-2">
        <Link href={`/items/${itemId}`} className="text-sm text-muted">
          ← Back
        </Link>
        <p className="mt-6 text-danger">{error}</p>
      </div>
    );
  }
  if (!recipe) return <p className="pt-10 text-center text-muted">Getting your recipe…</p>;

  const steps = recipe.steps;
  const last = steps.length + 1; // 0 = ingredients, 1..n = steps, n+1 = done
  // Saving the cook clears the stored progress; stay on the last screen to say so.
  const screen = saved ? last : Math.min(Math.max(progress.screen, 0), last);
  const go = (to: number) => {
    // Moving on from a step ticks it off; the item page shows the same ticks.
    const done = to > screen && screen >= 1 && screen <= steps.length && !progress.done.includes(screen - 1) ? [...progress.done, screen - 1] : progress.done;
    update({ screen: to, done });
    window.scrollTo({ top: 0 });
  };
  const names = recipe.ingredients.map((i) => i.name);
  const amount = (i: number) => [recipe.ingredients[i].quantity, recipe.ingredients[i].unit].filter(Boolean).join(' ');

  function startTimer(step: number, seconds: number) {
    alarm.prime(); // Sound needs a tap to be allowed; this tap is it.
    update({ timers: { ...progress.timers, [step]: Date.now() + seconds * 1000 } });
  }
  function clearTimer(step: string | number) {
    const rest = { ...progress.timers };
    delete rest[String(step)];
    update({ timers: rest });
  }

  const timers = Object.entries(progress.timers).sort((a, b) => a[1] - b[1]);

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <header className="flex items-center gap-3">
        <Link href={`/items/${itemId}`} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-lg">
          ✕
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title || recipe.title}</p>
          <p className="text-xs text-muted">
            {screen === 0 ? 'Get everything ready' : screen === last ? 'Done' : `Step ${screen} of ${steps.length}`}
          </p>
        </div>
      </header>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={screen}
        aria-label="Progress through the recipe"
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(screen / last) * 100}%` }} />
      </div>

      {timers.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {timers.map(([step, endsAt]) => {
            const left = (endsAt - now) / 1000;
            const over = left <= 0;
            return (
              <li
                key={step}
                className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5 ${over ? 'bg-warm text-on-accent' : 'border border-line bg-surface'}`}
              >
                <button onClick={() => go(Number(step) + 1)} className="min-w-0 flex-1 text-left">
                  <span className="block text-xs opacity-80">Step {Number(step) + 1}</span>
                  <span className="block text-lg font-bold tabular-nums">{over ? "⏰ Time's up" : `⏱ ${formatClock(left)}`}</span>
                </button>
                <button onClick={() => clearTimer(step)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${over ? 'bg-on-accent/20' : 'border border-line'}`}>
                  {over ? 'OK' : 'Stop'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex-1 py-6">
        {screen === 0 && (
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight">Ingredients</h1>
            <p className="mt-1 text-sm text-muted">
              Serves {recipe.servings}. Tick things off as you get them out.
            </p>
            <ul className="mt-4 flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {recipe.ingredients.map((ing, i) => {
                const got = progress.have.includes(i);
                return (
                  <li key={i}>
                    <button onClick={() => update({ have: toggled(progress.have, i) })} aria-pressed={got} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                      <span aria-hidden className="text-xl">
                        {ing.emoji}
                      </span>
                      <span className={`min-w-0 flex-1 text-lg ${got ? 'text-muted line-through' : ''}`}>
                        {amount(i) && <span className="font-semibold">{amount(i)} </span>}
                        {ing.name}
                      </span>
                      <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${got ? 'bg-success text-on-accent' : 'border-2 border-line'}`}>
                        {got ? '✓' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {screen >= 1 && screen <= steps.length && (
          <StepScreen
            key={screen}
            step={steps[screen - 1]}
            uses={stepIngredients(steps[screen - 1].text, names).map((i) => ({ emoji: recipe.ingredients[i].emoji, name: names[i], amount: amount(i) }))}
            running={progress.timers[String(screen - 1)] !== undefined}
            onStart={(seconds) => startTimer(screen - 1, seconds)}
          />
        )}

        {screen === last && (
          <section className="text-center">
            <p aria-hidden className="text-6xl">
              🎉
            </p>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight">All done. Enjoy!</h1>
            {saved ? (
              <div className="mt-6">
                <p className="font-semibold text-success">Saved. Your note will be on the recipe next time.</p>
                <Link href="/recipes" className="mt-4 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent">
                  Back to recipes
                </Link>
              </div>
            ) : (
              <div className="mt-6">
                <CookedForm
                  itemId={itemId}
                  onSaved={() => {
                    setSaved(true);
                    reset();
                  }}
                />
              </div>
            )}
          </section>
        )}
      </div>

      <nav className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button onClick={() => go(screen - 1)} disabled={screen === 0} className="rounded-2xl border border-line bg-surface px-5 py-4 font-semibold disabled:opacity-40">
          Back
        </button>
        {screen < last ? (
          <button onClick={() => go(screen + 1)} className="flex-1 rounded-2xl bg-accent py-4 text-lg font-bold text-on-accent">
            {screen === 0 ? 'Start cooking' : screen === steps.length ? 'Finish' : 'Next step'}
          </button>
        ) : (
          <Link href={`/items/${itemId}`} className="flex-1 rounded-2xl border border-line bg-surface py-4 text-center text-lg font-bold">
            Back to the recipe
          </Link>
        )}
      </nav>
    </div>
  );
}

function StepScreen({
  step,
  uses,
  running,
  onStart,
}: {
  step: Recipe['steps'][number];
  uses: { emoji: string; name: string; amount: string }[];
  running: boolean;
  onStart: (seconds: number) => void;
}) {
  const seconds = parseSeconds(step.time);
  return (
    <section>
      {step.emoji && (
        <p aria-hidden className="text-5xl">
          {step.emoji}
        </p>
      )}
      <p className="mt-4 text-2xl font-semibold leading-snug">{step.text}</p>

      {seconds !== null ? (
        <button
          onClick={() => onStart(seconds)}
          disabled={running}
          className="mt-6 flex w-full items-center justify-between rounded-2xl border border-warm/40 bg-warm/10 px-4 py-3.5 text-left disabled:opacity-60"
        >
          <span>
            <span className="block font-bold">⏱ {step.time}</span>
            <span className="block text-sm text-muted">{running ? 'Timer running, see the top of the screen' : 'Tap to start a timer'}</span>
          </span>
          {!running && <span className="rounded-xl bg-warm px-3.5 py-2 text-sm font-bold text-on-accent">Start</span>}
        </button>
      ) : (
        step.time && <p className="mt-6 inline-flex rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-muted ring-1 ring-line">⏱ {step.time}</p>
      )}

      {uses.length > 0 && (
        <div className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">For this step</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {uses.map((u, i) => (
              <li key={i} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2">
                <span aria-hidden>{u.emoji}</span>
                <span>
                  {u.amount && <span className="font-semibold">{u.amount} </span>}
                  {u.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** The current time, ticking twice a second while `active`. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 500);
    // A phone pauses timers in the background: catch up the moment it's back.
    const wake = () => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [active]);
  return now;
}

/** Keeps the screen on while this view is open (Screen Wake Lock API, where supported). */
function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const take = async () => {
      if (gone || lock || document.visibilityState !== 'visible') return;
      lock = await navigator.wakeLock.request('screen').catch(() => null);
      lock?.addEventListener('release', () => (lock = null));
    };
    take();
    // The browser drops the lock when the tab is hidden; take it again on return.
    document.addEventListener('visibilitychange', take);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', take);
      lock?.release().catch(() => {});
    };
  }, []);
}

/** A buzz and three beeps. `prime` must be called from a tap so the browser allows sound later. */
function useAlarm(): { prime: () => void; ring: () => void } {
  const audio = useRef<AudioContext | null>(null);
  const api = useRef({
    prime: () => {
      try {
        audio.current ??= new AudioContext();
        audio.current.resume().catch(() => {});
      } catch {
        // No sound on this device: the timer still shows and buzzes.
      }
    },
    ring: () => {
      navigator.vibrate?.([400, 200, 400, 200, 400]);
      const ctx = audio.current;
      if (!ctx) return;
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.2;
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.45);
        osc.stop(ctx.currentTime + i * 0.45 + 0.25);
      }
    },
  });
  return api.current;
}
