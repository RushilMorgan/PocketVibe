/**
 * Client-side mirror of the server's daily usage counters.
 *
 * The SERVER is the source of truth — it returns a `usage` object on every AI
 * response (and a structured 429 when a limit is hit). This store just caches
 * the latest figure per kind so the UI can show "X creations left today"
 * without an extra round-trip. It is intentionally display-only; never trust it
 * for enforcement.
 */

export type UsageKind = 'generation' | 'chat';
export type UsageTier = 'anonymous' | 'free' | 'pro';

export interface UsageSnapshot {
  used: number;
  limit: number;
  remaining: number;
  tier: UsageTier;
  resetsAt: string; // ISO timestamp of next reset (UTC midnight)
}

export type UsageState = Partial<Record<UsageKind, UsageSnapshot>>;

let state: UsageState = {};
const listeners = new Set<(s: UsageState) => void>();

function emit() {
  const snapshot = { ...state };
  listeners.forEach(l => l(snapshot));
}

/** Record the latest usage figure for a kind (from a server response). */
export function setUsage(kind: UsageKind, snapshot: UsageSnapshot): void {
  state = { ...state, [kind]: snapshot };
  emit();
}

/** Mark a kind as fully exhausted (from a 429 quota_exceeded response). */
export function setExhausted(kind: UsageKind, partial: Omit<UsageSnapshot, 'remaining'>): void {
  setUsage(kind, { ...partial, remaining: 0 });
}

export function getUsage(): UsageState {
  return state;
}

export function getRemaining(kind: UsageKind): number | null {
  return state[kind]?.remaining ?? null;
}

export function subscribe(listener: (s: UsageState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test/util: reset all cached usage. */
export function _resetUsageStore(): void {
  state = {};
  emit();
}
