/**
 * Pure helpers for the what-if card: putting Search's citations into the notes
 * the writer sees, and turning the writer's draft into the stored card. The
 * rule (docs/what-if.md B3): a "today" fact is kept only with a real source.
 */
import type { GroundingSupport } from '@/lib/ai/gemini';
import type { WhatIf, WhatIfDraft, WhatIfOrigin, WhatIfSource } from './schema';

/**
 * Adds " [n]" after each stretch of text Search backed, n counting sources
 * from 1. Stretches that can't be found in the text are skipped.
 */
export function citeText(text: string, supports: GroundingSupport[]): string {
  const marks = new Map<number, Set<number>>();
  let from = 0;
  for (const s of supports) {
    // Supports arrive in reading order; fall back to a search from the top if one doesn't.
    let at = text.indexOf(s.text, from);
    if (at === -1) at = text.indexOf(s.text);
    if (at === -1) continue;
    const end = at + s.text.length;
    from = end;
    const set = marks.get(end) ?? new Set<number>();
    for (const n of s.sources) set.add(n + 1);
    marks.set(end, set);
  }
  let out = text;
  for (const end of [...marks.keys()].sort((a, b) => b - a)) {
    const tags = [...marks.get(end)!].sort((a, b) => a - b).map((n) => `[${n}]`).join('');
    out = `${out.slice(0, end)} ${tags}${out.slice(end)}`;
  }
  return out;
}

/** "[2] reuters.com" per usable source, keeping Search's numbering (dead links leave a gap). */
export function sourceList(sources: (WhatIfSource | null)[]): string {
  return sources.flatMap((s, i) => (s ? [`[${i + 1}] ${s.site}`] : [])).join('\n');
}

/** "www.reuters.com" → "reuters.com"; null if it isn't a web address. */
export function siteOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

/**
 * The stored card: the draft plus its scenario, with each "today" fact given
 * its source's link. Facts pointing at a missing or dead source are dropped,
 * never shown unsourced.
 */
export function finishWhatIf(
  draft: WhatIfDraft,
  scenario: string,
  origin: WhatIfOrigin,
  sources: (WhatIfSource | null)[],
): WhatIf {
  const today = draft.today.flatMap((t) => {
    const source = sources[t.source - 1];
    return source ? [{ fact: t.fact, url: source.url, site: source.site }] : [];
  });
  const others = draft.other_scenarios.map((s) => s.trim());
  return { ...draft, scenario, origin, today, other_scenarios: others };
}
