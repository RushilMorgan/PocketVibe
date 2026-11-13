import 'server-only';
import { generateJson } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import type { PromptContext } from '@/lib/profile';
import { explainer, type ExplainMode, type Explainer } from './schemas';

const MODE_INSTRUCTIONS: Record<ExplainMode, string> = {
  normal: '',
  simpler: 'Make it simpler than you normally would: shorter words, a more everyday analogy, no technical terms at all.',
  deeper:
    'Go one level deeper than you normally would: name the key mechanism and the trade-offs, still in plain words.',
};

/**
 * The tech / news / other handler: 5-line summary, why it matters, explore
 * next. `modelId` is the user's Settings choice (undefined = the pro default).
 */
export async function explain(
  text: string,
  ctx: PromptContext,
  mode: ExplainMode = 'normal',
  modelId?: string,
): Promise<Explainer> {
  const instructions = await prompt('explainer', { ...ctx, mode_instruction: MODE_INSTRUCTIONS[mode] });
  return generateJson(explainer, [{ text: instructions }, { text: `Content:\n${text}` }], { feature: 'explainer', model: 'pro', modelId });
}
