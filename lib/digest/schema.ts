import { z } from 'zod';

/**
 * digests.content — everything the digest page and email render. Client-safe.
 * Links are plain targets here; delivery wraps them in signed tracking links.
 */

export const find = z.object({
  title: z.string().min(1).max(160),
  url: z.url(),
  why: z.string().min(1).max(200),
});

export type Find = z.infer<typeof find>;

export const digestContent = z.object({
  from: z.string(),
  to: z.string(),
  /** "Your week": saves grouped by their strongest topic. */
  groups: z.array(
    z.object({
      topic: z.string(),
      items: z.array(z.object({ id: z.string(), title: z.string(), line: z.string() })),
    }),
  ),
  /** "New for you": up to 3 finds for each of the top 3 topics. */
  finds: z.array(z.object({ topic: z.string(), items: z.array(find) })),
  /** Older digests: one lesson from something saved but never opened. New ones have null (docs/what-if.md, Part C). */
  lesson: z.object({ itemId: z.string(), itemTitle: z.string(), lessonId: z.string() }).nullable(),
  /** A what-if written but not yet opened (absent on digests from before what-ifs). */
  whatif: z.object({ itemId: z.string(), itemTitle: z.string(), scenario: z.string() }).nullable().optional(),
  stats: z.object({ saved: z.number(), played: z.number() }),
});

export type DigestContent = z.infer<typeof digestContent>;

/** Monday 00:00 SAST of the week a moment falls in, as YYYY-MM-DD. */
export function weekStart(now: Date): string {
  const sast = new Date(now.getTime() + 2 * 3600_000);
  const day = (sast.getUTCDay() + 6) % 7; // Monday = 0
  sast.setUTCDate(sast.getUTCDate() - day);
  return sast.toISOString().slice(0, 10);
}

/**
 * Files each item under its strongest topic (items can carry several), so an
 * item appears once. Untagged items go under "Other"; groups are ordered by
 * size, "Other" last.
 */
export function groupByTopic<T extends { id: string }>(
  items: T[],
  topicsFor: (itemId: string) => { name: string; weight: number }[],
): { topic: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const best = [...topicsFor(item.id)].sort((a, b) => b.weight - a.weight)[0];
    const key = best?.name ?? 'Other';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .map(([topic, list]) => ({ topic, items: list }))
    .sort((a, b) => (a.topic === 'Other' ? 1 : b.topic === 'Other' ? -1 : b.items.length - a.items.length));
}

/** Pulls the first JSON array out of model text (which may wrap it in prose or fences). */
export function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
