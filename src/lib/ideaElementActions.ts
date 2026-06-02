/**
 * Per-element action engine for the Idea Board "tap-to-talk" pattern.
 *
 * Given a tapped element, returns the 2–3 smartest actions for it based on the
 * board's current state — so it always feels like Toolie read your mind, never
 * like a generic menu. Mirrors the contextual-suggestion approach used for the
 * FAB chat in CreationComposer (buildIdeaBoardSuggestions).
 */
import type {
  IdeaThinkingBoardContent,
  IdeaRisk,
  IdeaMoneyModel,
  IdeaTargetUser,
  IdeaNextStep,
  IdeaOpportunity,
  IdeaMapBranch,
} from '../types';
import type { ElementAction, IdeaElementKind } from './ideaElements';

type AnyElement =
  | IdeaRisk | IdeaMoneyModel | IdeaTargetUser | IdeaNextStep | IdeaOpportunity | IdeaMapBranch
  | { kind: 'scalar'; value: string }
  | { kind: 'scores' };

export function getElementActions(
  kind: IdeaElementKind,
  element: unknown,
  _content: IdeaThinkingBoardContent,
): ElementAction[] {
  switch (kind) {
    case 'risk': {
      const r = element as IdeaRisk;
      const base: ElementAction[] = [
        { id: 'avoid', label: 'How do I avoid this?', prompt: 'How do I avoid or reduce this risk? Update the note with a concrete way to handle it, and add a next step if useful.' },
        { id: 'safer', label: 'Make a safer plan', prompt: 'Rework this idea slightly to make this risk much smaller, and explain the safer approach in the note.' },
      ];
      if (r?.severity === 'high') {
        base.push({ id: 'realistic', label: 'Is it really that bad?', prompt: 'Honestly reassess this risk. If it is overstated, lower the severity and explain why; if not, keep it and sharpen the note.' });
      } else {
        base.push({ id: 'whatif', label: 'What if it happens?', prompt: 'Describe what actually happens if this risk hits, and the single best thing to do about it, in the note.' });
      }
      return base;
    }

    case 'moneyIdea': {
      const m = element as IdeaMoneyModel;
      const actions: ElementAction[] = [
        { id: 'realistic', label: 'Make this more realistic', prompt: 'Make this money idea more realistic for an everyday founder. Adjust the note and confidence honestly.' },
      ];
      if (!m?.note || !/\bR\s?\d/.test(m?.note ?? '')) {
        actions.push({ id: 'price', label: 'Suggest a price', prompt: 'Suggest a specific, realistic price point in Rands for this model and put it in the note.' });
      } else {
        actions.push({ id: 'cheaper', label: 'A cheaper way in', prompt: 'Suggest a lower-cost or free-tier entry point for this model and update the note.' });
      }
      actions.push({ id: 'who', label: 'Who would pay?', prompt: 'Explain who exactly would pay for this and why, in the note.' });
      return actions;
    }

    case 'targetUser': {
      const u = element as IdeaTargetUser;
      const vague = !u?.need || u.need.length < 12 || /\b(people|everyone|users|anyone)\b/i.test(u?.name ?? '');
      const actions: ElementAction[] = [];
      if (vague) {
        actions.push({ id: 'specific', label: 'Who exactly is this?', prompt: 'Make this user much more specific — a real, concrete persona with a sharper name and need.' });
      }
      actions.push(
        { id: 'pay', label: 'Why would they pay?', prompt: 'Explain why this user would actually pay for the idea, in their "why they care" field.' },
        { id: 'reach', label: 'How do I reach them?', prompt: 'Suggest where to find this kind of user, and add a next step to go reach them.' },
      );
      return actions.slice(0, 3);
    }

    case 'nextStep': {
      return [
        { id: 'smaller', label: 'Break into smaller steps', prompt: 'Break this step into a clearer, smaller first action, and add 1–2 follow-up next steps.' },
        { id: 'need', label: 'What do I need first?', prompt: 'Spell out what I need before I can do this step, and rewrite it to be doable this week.' },
        { id: 'how', label: 'How exactly?', prompt: 'Make this step concrete and specific so I know exactly what to do.' },
      ];
    }

    case 'opportunity': {
      return [
        { id: 'capitalise', label: 'How do I use this?', prompt: 'Explain how to capitalise on this opportunity, and add a next step to act on it.' },
        { id: 'bigger', label: 'Make it bigger', prompt: 'Push this opportunity further — what is the most ambitious version?' },
      ];
    }

    case 'mapBranch': {
      return [
        { id: 'expand', label: 'Explore this further', prompt: 'Expand this branch with sharper, more specific items drawn from the idea.' },
        { id: 'simpler', label: 'Make it simpler', prompt: 'Simplify this branch down to the few things that really matter.' },
      ];
    }

    case 'summary':
      return [
        { id: 'clearer', label: 'Make it clearer', prompt: 'Rewrite the idea summary to be clearer and sharper, in plain language.' },
        { id: 'shorter', label: 'One punchy line', prompt: 'Rewrite the idea summary as one punchy, memorable sentence.' },
        { id: 'exciting', label: 'Make it exciting', prompt: 'Rewrite the idea summary to feel exciting and compelling, without hype.' },
      ];

    case 'problem':
      return [
        { id: 'sharper', label: 'Make it sharper', prompt: 'Rewrite the problem to be sharper and more specific about who hurts and how.' },
        { id: 'bigger', label: 'Is this a real problem?', prompt: 'Stress-test the problem: is it real and worth solving? Rewrite it honestly.' },
      ];

    case 'solution':
      return [
        { id: 'simpler', label: 'Simplest version', prompt: 'Rewrite the solution as the simplest version that could still work.' },
        { id: 'different', label: 'What makes it different?', prompt: 'Rewrite the solution to make clear what makes it different from what exists.' },
      ];

    case 'scores':
      return [
        { id: 'honest', label: 'Be brutally honest', prompt: 'Re-score this idea brutally honestly across all six scores, reflecting real trade-offs.' },
        { id: 'why', label: 'Why these scores?', prompt: 'Re-evaluate the scores and adjust any that are off, reflecting the current board.' },
      ];
  }
}

// re-export for convenience
export type { AnyElement };
