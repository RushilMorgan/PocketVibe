import type { IdeaThinkingBoardContent, IdeaScores } from '../types';

/**
 * Industry-standard thinking frameworks (SWOT, ICE) derived live from the
 * board's existing data — no schema change, no extra AI call. The aim is to
 * show the user their own idea through lenses product teams and investors
 * actually use.
 */

export interface SwotGrid {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

const clamp = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 5;

const STRENGTH_LABELS: Array<[keyof IdeaScores, string]> = [
  ['clarity', 'Clearly defined — you know exactly what this is'],
  ['usefulness', 'Solves a real, felt need'],
  ['easeToBuild', 'Cheap and quick to get started'],
  ['moneyPotential', 'Clear paths to making money'],
  ['confidence', 'Strong conviction behind it'],
];

const WEAKNESS_LABELS: Array<[keyof IdeaScores, string]> = [
  ['clarity', 'Still fuzzy — needs a sharper definition'],
  ['usefulness', 'The need it serves is unproven'],
  ['easeToBuild', 'Hard or costly to get off the ground'],
  ['moneyPotential', 'No obvious way to make money yet'],
  ['confidence', 'Low conviction — worth asking why'],
];

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * SWOT, computed honestly from what the board already knows:
 * Opportunities and Threats map 1:1 to the board's opportunity/risk items;
 * Strengths and Weaknesses are read from the idea-health scores.
 */
export function buildSwot(content: IdeaThinkingBoardContent): SwotGrid {
  const s = content.scores;
  const strengths = STRENGTH_LABELS
    .filter(([key]) => clamp(s?.[key]) >= 7)
    .map(([, label]) => label)
    .slice(0, 3);

  const weaknesses = WEAKNESS_LABELS
    .filter(([key]) => clamp(s?.[key]) <= 4)
    .map(([, label]) => label);
  // riskLevel is the one score where high = bad (lower = safer)
  if (clamp(s?.riskLevel) >= 7) weaknesses.push('Overall risk runs high — de-risk before investing');

  const opportunities = (content.opportunities ?? []).map(o => o.title).slice(0, 3);
  const threats = [...(content.risks ?? [])]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3))
    .map(r => r.title)
    .slice(0, 3);

  return { strengths, weaknesses: weaknesses.slice(0, 3), opportunities, threats };
}

export interface IceResult {
  impact: number;
  confidence: number;
  ease: number;
  /** Average of the three, one decimal (0–10). */
  total: number;
  verdict: string;
}

/**
 * ICE prioritisation (Impact × Confidence × Ease) — the standard quick test
 * for "is this worth doing next?". Mapped from the board's scores: impact ←
 * usefulness, confidence ← confidence, ease ← easeToBuild.
 */
export function iceScore(scores: IdeaScores | undefined): IceResult {
  const impact = clamp(scores?.usefulness);
  const confidence = clamp(scores?.confidence);
  const ease = clamp(scores?.easeToBuild);
  const total = Math.round(((impact + confidence + ease) / 3) * 10) / 10;
  const verdict =
    total >= 7.5 ? 'Strong — worth testing this week'
    : total >= 5.5 ? 'Promising — shore up the weakest leg'
    : total >= 3.5 ? 'Needs shaping before you invest much'
    : 'High caution — revisit the basics first';
  return { impact, confidence, ease, total, verdict };
}
