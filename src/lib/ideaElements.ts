/**
 * Shared types for the Idea Board "tap-to-talk" inline AI.
 *
 * Every card on the board is a live element the user can tap, talk to, and watch
 * reshape itself in place. An element is identified by its `kind` (which array or
 * field it lives in) and, for collection items, its `id`. The AI returns a small
 * `ElementPatch` that is merged deterministically by `applyElementPatch` — so only
 * the touched element changes and the rest of the board stays frozen.
 */
import type {
  IdeaScores,
  IdeaRisk,
  IdeaNextStep,
  IdeaMoneyModel,
} from '../types';

/** Which element on the board is being edited. */
export type IdeaElementKind =
  | 'risk'
  | 'moneyIdea'
  | 'targetUser'
  | 'nextStep'
  | 'opportunity'
  | 'mapBranch'
  | 'summary'
  | 'problem'
  | 'solution'
  | 'scores';

/** Kinds that live in an array and are addressed by id. */
export const COLLECTION_KINDS: IdeaElementKind[] = [
  'risk', 'moneyIdea', 'targetUser', 'nextStep', 'opportunity', 'mapBranch',
];

/** Kinds that are a single scalar/object field (no id). */
export const SCALAR_KINDS: IdeaElementKind[] = ['summary', 'problem', 'solution', 'scores'];

/** A contextual action offered for a tapped element. */
export interface ElementAction {
  id: string;
  label: string;
  /** Free-form instruction sent to the AI element-edit endpoint. */
  prompt?: string;
  /** Deterministic local action that needs no AI. */
  localAction?: 'delete';
}

/**
 * The scoped change the AI returns for one element. Interpreted by kind:
 *  - collection kinds   → `element` replaces the item by id (id preserved)
 *  - summary/problem/solution → `text`
 *  - scores             → `scores` (partial, clamped on apply)
 * Plus optional "linked magic": appending a follow-up next-step / risk, etc.
 */
export interface ElementPatch {
  /** Updated array element or map branch (must keep the same id). */
  element?: Record<string, unknown>;
  /** New value for a scalar text field. */
  text?: string;
  /** Partial score updates (clamped 1–10 on apply). */
  scores?: Partial<IdeaScores>;
  /** Optional follow-ups the AI suggests as a result of this change. */
  addNextSteps?: Array<Partial<IdeaNextStep>>;
  addRisks?: Array<Partial<IdeaRisk>>;
  addMoneyIdeas?: Array<Partial<IdeaMoneyModel>>;
  /** Optional one-line note from the AI (not persisted; can be shown transiently). */
  note?: string;
}

/** Human label for a kind, used in the sheet header. */
export function kindLabel(kind: IdeaElementKind): string {
  switch (kind) {
    case 'risk':        return 'this risk';
    case 'moneyIdea':   return 'this money idea';
    case 'targetUser':  return 'this user';
    case 'nextStep':    return 'this step';
    case 'opportunity': return 'this opportunity';
    case 'mapBranch':   return 'this branch';
    case 'summary':     return 'the idea summary';
    case 'problem':     return 'the problem';
    case 'solution':    return 'the solution';
    case 'scores':      return 'the scores';
  }
}
