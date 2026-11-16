/**
 * Pure helpers for the Playbook (docs/playbook.md): telling two names for the
 * same framework apart, the text the models are shown, turning the writer's
 * draft into the stored run, the Playbook page's search, and the brief for the
 * Council. Tested in playbook.test.ts.
 */
import { IDEA_MAX, IDEA_MIN, MAX_LENSES, type Framework, type FrameworkDraft, type Run, type RunContent, type RunDraft } from './schema';

/**
 * One key per framework, so "The Jobs-to-be-Done Framework (JTBD)" from one
 * save and "Jobs to be done" from another are the same playbook entry.
 */
export function nameKey(name: string): string {
  const words = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length > 1 && words[0] === 'the') words.shift();
  if (words.length > 1 && words[words.length - 1] === 'framework') words.pop();
  return words.join(' ');
}

/** Tidies what the model wrote: trimmed, areas lowercase and unique, no two with the same key. */
export function cleanFrameworks(drafts: FrameworkDraft[]): FrameworkDraft[] {
  const seen = new Set<string>();
  const out: FrameworkDraft[] = [];
  for (const d of drafts) {
    const name = d.name.replace(/\s+/g, ' ').trim();
    const key = nameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...d,
      name,
      from: d.from?.trim() || null,
      watch_out: d.watch_out?.trim() || null,
      example: d.example?.trim() || null,
      areas: [...new Set(d.areas.map((a) => a.trim().toLowerCase()).filter(Boolean))],
    });
  }
  return out;
}

/** Trimmed, spacing tidied, cut to IDEA_MAX. Null if it's too short to work with. */
export function cleanIdea(raw: string): string | null {
  const idea = raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, IDEA_MAX);
  return idea.length >= IDEA_MIN ? idea : null;
}

/** "3. Jobs to be done: what it is. Use when: …" per framework, for the picker. */
export function pickList(frameworks: Pick<Framework, 'name' | 'gist' | 'use_when'>[]): string {
  return frameworks.map((f, i) => `${i + 1}. ${f.name}: ${f.gist} Use when: ${f.use_when}`).join('\n');
}

/** The picker's numbers as positions in the list: in range, unique, at most MAX_LENSES. */
export function pickedIndexes(picks: number[], count: number): number[] {
  return [...new Set(picks.map((n) => n - 1).filter((i) => Number.isInteger(i) && i >= 0 && i < count))].slice(0, MAX_LENSES);
}

/** A framework written out in full for the model applying it, numbered [n]. */
export function frameworkText(f: FrameworkDraft, n: number): string {
  return [
    `[${n}] ${f.name}${f.from ? ` (${f.from})` : ''}`,
    f.gist,
    f.parts.length ? `Parts:\n${f.parts.map((p, i) => `${i + 1}. ${p.label}${p.detail ? `: ${p.detail}` : ''}`).join('\n')}` : '',
    `Use when: ${f.use_when}`,
    f.watch_out ? `Watch out: ${f.watch_out}` : '',
    `It asks:\n${f.questions.map((q) => `- ${q}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * The stored run: each lens gets the real framework for the number the writer
 * cited. A lens citing a number that wasn't offered, or a framework already
 * used, is dropped. Null if nothing is left.
 */
export function finishRun(draft: RunDraft, offered: Pick<Framework, 'id' | 'name'>[]): RunContent | null {
  const used = new Set<string>();
  const lenses = draft.lenses.flatMap(({ framework: n, ...lens }) => {
    const f = offered[n - 1];
    if (!f || used.has(f.id)) return [];
    used.add(f.id);
    return [{ frameworkId: f.id, name: f.name, ...lens }];
  });
  return lenses.length ? { ...draft, lenses } : null;
}

/** Every area in the playbook with how many frameworks have it, most used first. */
export function areaCounts(frameworks: Pick<Framework, 'areas'>[]): { area: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const f of frameworks) for (const a of f.areas) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts.entries()].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}

/** The Playbook page's search box and area chips: every typed word must appear somewhere in the framework. */
export function filterFrameworks<T extends Pick<Framework, 'name' | 'gist' | 'use_when' | 'areas' | 'from' | 'parts'>>(
  frameworks: T[],
  opts: { search?: string; area?: string | null },
): T[] {
  const words = (opts.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return frameworks.filter((f) => {
    if (opts.area && !f.areas.includes(opts.area)) return false;
    if (!words.length) return true;
    const text = [f.name, f.gist, f.use_when, f.from ?? '', ...f.areas, ...f.parts.map((p) => p.label)].join(' ').toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** Taking a finished run to the Council: the idea, what each framework showed, and what to test. */
export function runBrief(r: Pick<Run, 'idea' | 'lenses' | 'bottom_line'>): string {
  return [
    r.idea,
    `I've worked this through some frameworks I keep. What each showed:\n${r.lenses.map((l) => `- ${l.name}: ${l.insight}`).join('\n')}`,
    `Where that left me: ${r.bottom_line}`,
    'Stress-test it. Is the idea sound, where is this analysis wrong or too kind, and what did the frameworks miss?',
  ].join('\n\n');
}
