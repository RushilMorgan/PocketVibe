'use client';

import { useCallback, useEffect, useState } from 'react';

/** Where you are in a recipe: kept on this device so a locked screen or a switch of apps doesn't lose it. */
export interface CookProgress {
  /** Ingredients ticked off, by position. */
  have: number[];
  /** Steps ticked off, by position. */
  done: number[];
  /** The screen the cooking view is on (0 = ingredients). */
  screen: number;
  /** Servings the amounts are scaled to; unset = the recipe's own. */
  servings?: number;
  /** Running timers: step position → when it ends (ms since epoch). */
  timers: Record<string, number>;
  savedAt: number;
}

const EMPTY: CookProgress = { have: [], done: [], screen: 0, timers: {}, savedAt: 0 };
/** A cook is one sitting: progress older than this starts fresh. */
const KEEP_MS = 12 * 3600_000;

/**
 * Progress for one recipe, remembered in this browser under `cook:<key>`.
 * With no key (the standalone recipe tool) it just lives in memory. Storage
 * can be unavailable (private windows), so every access is guarded.
 */
export function useCookProgress(key: string | null): [CookProgress, (patch: Partial<CookProgress>) => void, () => void] {
  const [progress, setProgress] = useState<CookProgress>(EMPTY);
  const storageKey = key ? `cook:${key}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as CookProgress | null;
      if (saved && Date.now() - saved.savedAt < KEEP_MS) setProgress({ ...EMPTY, ...saved });
    } catch {
      // Nothing saved, or storage is off: start fresh.
    }
  }, [storageKey]);

  const update = useCallback(
    (patch: Partial<CookProgress>) =>
      setProgress((prev) => {
        const next = { ...prev, ...patch, savedAt: Date.now() };
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // Storage is full or off: progress stays in memory for this visit.
          }
        }
        return next;
      }),
    [storageKey],
  );

  const reset = useCallback(() => {
    setProgress(EMPTY);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Nothing to clear.
      }
    }
  }, [storageKey]);

  return [progress, update, reset];
}

export function toggled(list: number[], i: number): number[] {
  return list.includes(i) ? list.filter((n) => n !== i) : [...list, i];
}
