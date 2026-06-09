/**
 * Merges a user's local (device) creations with the tools saved to their cloud
 * account into a single, de-duplicated list for the unified "My things" screen.
 *
 * De-dup rule: a cloud tool whose `share_slug` matches the `shareSlug` of a
 * local creation is dropped — the local entry already represents it (and can be
 * opened/edited offline), so we avoid showing it twice. Cloud tools with no
 * local counterpart appear as read-only "cloud" entries that open via their
 * shared link.
 */
import type { Creation } from '../types';

/** A row from the Supabase `shared_creations` table (owned by the user). */
export interface CloudTool {
  id: string;
  share_slug: string;
  title: string;
  creation_type: string;
  created_at: string;
  updated_at: string;
  public_view: boolean;
  tags?: string[];   // extracted from content.tags (e.g. recipes) for cookbook filtering
}

export type UnifiedThing =
  | { kind: 'local'; key: string; updatedAtMs: number; creation: Creation }
  | { kind: 'cloud'; key: string; updatedAtMs: number; tool: CloudTool };

/** Tags on a unified item, for the cookbook tag filter. */
export function thingTags(t: UnifiedThing): string[] {
  if (t.kind === 'local') {
    const tags = (t.creation.content as { tags?: unknown }).tags;
    return Array.isArray(tags) ? tags.filter((x): x is string => typeof x === 'string') : [];
  }
  return t.tool.tags ?? [];
}

/**
 * Returns the merged list, newest first. `cloud` may be empty (e.g. signed-out
 * users or before the network request resolves), in which case the result is
 * simply the local creations sorted by recency.
 */
export function mergeThings(creations: Creation[], cloud: CloudTool[]): UnifiedThing[] {
  const localSlugs = new Set(
    creations.map(c => c.shareSlug).filter((s): s is string => Boolean(s)),
  );

  const localItems: UnifiedThing[] = creations.map(c => ({
    kind: 'local',
    key: c.id,
    updatedAtMs: c.updatedAt,
    creation: c,
  }));

  const cloudItems: UnifiedThing[] = cloud
    .filter(t => !localSlugs.has(t.share_slug))
    .map(t => ({
      kind: 'cloud',
      key: t.id,
      updatedAtMs: Date.parse(t.updated_at) || 0,
      tool: t,
    }));

  return [...localItems, ...cloudItems].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}
