import type { IdeaDecisionMatrix, IdeaMatrixCriterion, IdeaMatrixOption, IdeaWhyStep } from '../types';

/**
 * Defensive parsing + ranking for the AI-written decision matrix and Five
 * Whys chain. The model fills these for decision/comparison/validate boards;
 * anything malformed degrades to "not present" rather than a broken visual.
 */

const clampN = (n: unknown, lo: number, hi: number, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;

const asNonEmptyString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

/** Accepts strings or {text|why|answer} objects; null unless 2–6 usable steps. */
export function normalizeFiveWhys(raw: unknown): IdeaWhyStep[] | null {
  if (!Array.isArray(raw)) return null;
  const steps: IdeaWhyStep[] = [];
  for (const entry of raw) {
    const obj = entry as Record<string, unknown> | string;
    const text = typeof obj === 'string'
      ? asNonEmptyString(obj)
      : asNonEmptyString(obj?.text) ?? asNonEmptyString(obj?.why) ?? asNonEmptyString(obj?.answer);
    if (text) steps.push({ id: `w${steps.length + 1}`, text });
    if (steps.length === 6) break;
  }
  return steps.length >= 2 ? steps : null;
}

/** Valid matrix or null: ≥2 options, ≥2 criteria; weights/scores clamped. */
export function sanitizeMatrix(raw: unknown): IdeaDecisionMatrix | null {
  const m = raw as Record<string, unknown> | undefined;
  if (!m || typeof m !== 'object') return null;

  const options: IdeaMatrixOption[] = (Array.isArray(m.options) ? m.options : [])
    .map((o, i): IdeaMatrixOption | null => {
      const obj = o as Record<string, unknown>;
      const label = asNonEmptyString(obj?.label) ?? asNonEmptyString(obj?.name);
      if (!label) return null;
      const opt: IdeaMatrixOption = { id: asNonEmptyString(obj?.id) ?? `opt${i + 1}`, label };
      const emoji = asNonEmptyString(obj?.emoji);
      if (emoji) opt.emoji = emoji;
      return opt;
    })
    .filter((o): o is IdeaMatrixOption => o !== null)
    .slice(0, 4);

  const criteria: IdeaMatrixCriterion[] = (Array.isArray(m.criteria) ? m.criteria : [])
    .map((c, i) => {
      const obj = c as Record<string, unknown>;
      const label = asNonEmptyString(obj?.label) ?? asNonEmptyString(obj?.name);
      if (!label) return null;
      return {
        id: asNonEmptyString(obj?.id) ?? `c${i + 1}`,
        label,
        weight: clampN(obj?.weight, 1, 5, 3),
      };
    })
    .filter((c): c is IdeaMatrixCriterion => c !== null)
    .slice(0, 5);

  if (options.length < 2 || criteria.length < 2) return null;

  const rawScores = (m.scores ?? {}) as Record<string, Record<string, unknown>>;
  const scores: Record<string, Record<string, number>> = {};
  for (const opt of options) {
    scores[opt.id] = {};
    for (const crit of criteria) {
      scores[opt.id][crit.id] = clampN(rawScores?.[opt.id]?.[crit.id], 1, 10, 5);
    }
  }
  return { options, criteria, scores };
}

export interface RankedCriterion {
  id: string;
  label: string;
  weight: number;
  score: number;
}

export interface RankedOption {
  id: string;
  label: string;
  emoji?: string;
  /** Weighted average across criteria, one decimal (1–10). */
  total: number;
  perCriterion: RankedCriterion[];
}

/** Options ranked by weighted average score, best first. */
export function rankOptions(matrix: IdeaDecisionMatrix): RankedOption[] {
  const weightSum = matrix.criteria.reduce((acc, c) => acc + c.weight, 0) || 1;
  return matrix.options
    .map(opt => {
      const perCriterion = matrix.criteria.map(c => ({
        id: c.id,
        label: c.label,
        weight: c.weight,
        score: matrix.scores[opt.id]?.[c.id] ?? 5,
      }));
      const total = Math.round(
        (perCriterion.reduce((acc, c) => acc + c.score * c.weight, 0) / weightSum) * 10,
      ) / 10;
      return { id: opt.id, label: opt.label, emoji: opt.emoji, total, perCriterion };
    })
    .sort((a, b) => b.total - a.total);
}
