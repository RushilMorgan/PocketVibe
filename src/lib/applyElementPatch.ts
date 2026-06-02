/**
 * Apply a scoped ElementPatch to an Idea Board, mutating only the touched
 * element so the rest of the board stays frozen. Pure: returns a new content
 * object and never mutates its input.
 */
import type {
  IdeaThinkingBoardContent,
  IdeaRisk,
  IdeaMoneyModel,
  IdeaNextStep,
  IdeaScores,
} from '../types';
import type { ElementPatch, IdeaElementKind } from './ideaElements';

const clampScore = (v: unknown, fallback: number): number =>
  typeof v === 'number' && !Number.isNaN(v) ? Math.max(1, Math.min(10, Math.round(v))) : fallback;

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
}

/** Append any AI-suggested linked follow-ups (next steps / risks / money ideas). */
function appendLinked(content: IdeaThinkingBoardContent, patch: ElementPatch): IdeaThinkingBoardContent {
  let next = content;
  if (patch.addNextSteps?.length) {
    const steps: IdeaNextStep[] = patch.addNextSteps
      .filter(s => typeof s?.label === 'string' && s.label!.trim())
      .map(s => ({ id: uid('ns'), label: String(s.label), done: false }));
    if (steps.length) next = { ...next, nextSteps: [...next.nextSteps, ...steps] };
  }
  if (patch.addRisks?.length) {
    const risks: IdeaRisk[] = patch.addRisks
      .filter(r => typeof r?.title === 'string' && r.title!.trim())
      .map(r => ({
        id: uid('r'),
        title: String(r.title),
        severity: (r.severity === 'low' || r.severity === 'high') ? r.severity : 'medium',
        note: String(r.note ?? ''),
      }));
    if (risks.length) next = { ...next, risks: [...next.risks, ...risks] };
  }
  if (patch.addMoneyIdeas?.length) {
    const money: IdeaMoneyModel[] = patch.addMoneyIdeas
      .filter(m => typeof m?.model === 'string' && m.model!.trim())
      .map(m => ({ id: uid('m'), model: String(m.model), note: String(m.note ?? ''), confidence: clampScore(m.confidence, 5) }));
    if (money.length) next = { ...next, moneyIdeas: [...next.moneyIdeas, ...money] };
  }
  return next;
}

/** Replace an item by id within an array field, merging the patch element over it. */
function replaceById<T extends { id: string }>(arr: T[], id: string, patchEl: Record<string, unknown>): T[] {
  return arr.map(item => (item.id === id ? ({ ...item, ...patchEl, id: item.id } as T) : item));
}

export function applyElementPatch(
  content: IdeaThinkingBoardContent,
  kind: IdeaElementKind,
  elementId: string | null,
  patch: ElementPatch,
): IdeaThinkingBoardContent {
  if (!patch || typeof patch !== 'object') return content;

  let next: IdeaThinkingBoardContent = content;

  switch (kind) {
    case 'risk':
      if (elementId && patch.element) next = { ...next, risks: replaceById(next.risks, elementId, patch.element) };
      break;
    case 'moneyIdea':
      if (elementId && patch.element) {
        next = { ...next, moneyIdeas: replaceById(next.moneyIdeas, elementId, patch.element) };
        // keep confidence clamped if the AI touched it
        next = { ...next, moneyIdeas: next.moneyIdeas.map(m => m.id === elementId ? { ...m, confidence: clampScore(m.confidence, m.confidence) } : m) };
      }
      break;
    case 'targetUser':
      if (elementId && patch.element) next = { ...next, targetUsers: replaceById(next.targetUsers, elementId, patch.element) };
      break;
    case 'nextStep':
      if (elementId && patch.element) next = { ...next, nextSteps: replaceById(next.nextSteps, elementId, patch.element) };
      break;
    case 'opportunity':
      if (elementId && patch.element) next = { ...next, opportunities: replaceById(next.opportunities, elementId, patch.element) };
      break;
    case 'mapBranch':
      if (elementId && patch.element) {
        next = {
          ...next,
          visualMap: { ...next.visualMap, branches: replaceById(next.visualMap.branches, elementId, patch.element) },
        };
      }
      break;
    case 'summary':
      if (typeof patch.text === 'string') next = { ...next, ideaSummary: patch.text };
      break;
    case 'problem':
      if (typeof patch.text === 'string') next = { ...next, problem: patch.text };
      break;
    case 'solution':
      if (typeof patch.text === 'string') next = { ...next, solution: patch.text };
      break;
    case 'scores':
      if (patch.scores && typeof patch.scores === 'object') {
        const s = next.scores;
        const p = patch.scores as Partial<IdeaScores>;
        next = {
          ...next,
          scores: {
            clarity:        clampScore(p.clarity, s.clarity),
            usefulness:     clampScore(p.usefulness, s.usefulness),
            easeToBuild:    clampScore(p.easeToBuild, s.easeToBuild),
            moneyPotential: clampScore(p.moneyPotential, s.moneyPotential),
            riskLevel:      clampScore(p.riskLevel, s.riskLevel),
            confidence:     clampScore(p.confidence, s.confidence),
          },
        };
      }
      break;
  }

  // Linked follow-ups apply regardless of kind.
  next = appendLinked(next, patch);
  return next;
}
