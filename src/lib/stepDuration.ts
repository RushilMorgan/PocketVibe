/**
 * Parse cooking durations out of recipe steps so any step with a time in it
 * ("Bake for 20–25 minutes", "1 hour 30 min") becomes a tappable timer.
 * Pure + client-side; the step's explicit `time` field wins over its text.
 */

const DURATION_RE =
  /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|—|to)\s*\d+(?:[.,]\d+)?)?[\s-]*(hours?|hrs?|h\b|minutes?|mins?|m\b|seconds?|secs?|s\b)/gi;

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  return u.startsWith('h') ? 3600 : u.startsWith('m') ? 60 : 1;
}

function matchSeconds(m: RegExpMatchArray): number {
  // For a range ("20–25 min") use the lower bound — check early, cook longer.
  return parseFloat(m[1].replace(',', '.')) * unitSeconds(m[2]);
}

/**
 * First duration mentioned in the text, in seconds. Compound durations are
 * summed only when they read as one ("1 hour 30 minutes") — a comma or other
 * words between them means separate actions, and only the first one counts.
 */
export function parseDurationSeconds(text: string): number | null {
  const matches = [...text.matchAll(DURATION_RE)];
  if (matches.length === 0) return null;
  let total = matchSeconds(matches[0]);
  let prev = matches[0];
  for (let i = 1; i < matches.length; i++) {
    const m = matches[i];
    const gap = text.slice((prev.index ?? 0) + prev[0].length, m.index);
    if (/^[\sand]*$/i.test(gap) && unitSeconds(m[2]) < unitSeconds(prev[2])) {
      total += matchSeconds(m);
      prev = m;
    } else {
      break;
    }
  }
  return Math.round(total);
}

/** Timer length for a step: explicit time field first, then the step text. */
export function stepTimerSeconds(step: { text: string; time?: string }): number | null {
  return parseDurationSeconds(step.time ?? '') ?? parseDurationSeconds(step.text);
}

/** "12:05" / "1:02:05" — live countdown display. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** "20 min" / "1 h 30 min" / "90 sec" — human label for an unstarted timer. */
export function formatDurationShort(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s && !h) parts.push(`${s} sec`);
  return parts.join(' ') || '0 sec';
}
