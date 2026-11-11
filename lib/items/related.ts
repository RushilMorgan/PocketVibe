/**
 * "Connects to …" between saves (docs/saves-redesign.md B4). Pure; the job
 * step lives in lib/items/actions.ts (linkRelated).
 */
import type { RelatedSave } from '@/lib/supabase/database.types';

/**
 * Best-chunk cosine similarity a save must reach to count as connected.
 * Measured 2026-11-11 on real saves with gemini-embedding-001: genuinely
 * related pairs (same-cuisine recipes, the AI-income videos) scored 0.82–0.87;
 * unrelated pairs reached 0.77. Re-measure if the embedding model changes.
 */
export const RELATED_MIN = 0.8;

export function pickRelated(
  similar: { id: string; title: string | null; similarity: number }[],
  min = RELATED_MIN,
): RelatedSave | null {
  const best = [...similar].sort((a, b) => b.similarity - a.similarity)[0];
  if (!best || best.similarity < min) return null;
  return { itemId: best.id, title: best.title, similarity: Math.round(best.similarity * 1000) / 1000 };
}
