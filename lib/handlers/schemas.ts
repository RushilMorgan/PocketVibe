import { z } from 'zod';

/**
 * Output shapes for item_outputs.content. Shared by server (validation of AI
 * output) and client (rendering), so no server-only imports here.
 */

export const recipe = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(200).describe('One plain sentence: what the dish is and why it is good'),
  servings: z.number().int().min(1).max(50),
  prepTime: z.string().max(30).describe('e.g. "10 min"'),
  cookTime: z.string().max(30),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.string().describe('Plain text, e.g. "1/2", "a pinch". Empty if unknown'),
        unit: z.string().describe('e.g. "cup", "g". Empty if none'),
        emoji: z.string().max(8),
      }),
    )
    .min(1),
  steps: z
    .array(
      z.object({
        text: z.string().min(1),
        time: z.string().describe('How long this step takes, e.g. "5 min". Empty if instant'),
        emoji: z.string().max(8),
      }),
    )
    .min(1),
  tags: z.array(z.string()).max(6),
});

export type Recipe = z.infer<typeof recipe>;

/** A recipe as plain text — what gets indexed for chat, instead of the noisy source page. */
export function recipeText(r: Recipe): string {
  return [
    `${r.title}. ${r.description}`,
    `Serves ${r.servings}. Prep ${r.prepTime}. Cook ${r.cookTime}.`,
    `Ingredients:\n${r.ingredients.map((i) => `- ${[i.quantity, i.unit, i.name].filter(Boolean).join(' ')}`).join('\n')}`,
    `Method:\n${r.steps.map((s, n) => `${n + 1}. ${s.text}${s.time ? ` (${s.time})` : ''}`).join('\n')}`,
    r.tags.length ? `Tags: ${r.tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const explainer = z.object({
  lines: z.array(z.string().min(1)).min(1).max(5).describe('The explanation: at most 5 short lines'),
  why_it_matters: z.string().min(1),
  explore_next: z.array(z.string().min(1)).length(3),
  hype_check: z
    .string()
    .nullable()
    .describe('Which claims are hype vs established, in plain words. null if the content makes no claims'),
});

export type Explainer = z.infer<typeof explainer>;

export type ExplainMode = 'normal' | 'simpler' | 'deeper';

/** item_outputs.content for type 'diagram'; the PNG lives in file_url. */
export const diagram = z.object({
  mermaid: z.string().min(1).describe('Mermaid code only, no code fences'),
  caption: z.string().min(1).max(160).describe('One plain sentence on what the diagram shows'),
});

export type Diagram = z.infer<typeof diagram>;
