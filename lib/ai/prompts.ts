import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fillTemplate } from './template';

export type PromptName = 'classifier' | 'video-digest' | 'recipe' | 'explainer' | 'chat' | 'diagram' | 'lesson' | 'lesson-pick' | 'lesson-quiz' | 'lesson-simulator' | 'lesson-order' | 'lesson-spot_bug' | 'finds' | 'finds-pick'
  | 'council-frame' | 'council-research' | 'council-take' | 'council-rebut' | 'council-synthesize' | 'council-ratify'
  | 'council-revise' | 'council-followup' | 'council-followup-answer' | 'review-connect' | 'topic-themes' | 'whatif' | 'whatif-facts';

const cache = new Map<PromptName, string>();

/**
 * Loads /prompts/<name>.md and fills its {placeholders}. Prompts live in files
 * so they can be tuned without touching code.
 */
export async function prompt(name: PromptName, vars: Record<string, string>): Promise<string> {
  let template = cache.get(name);
  if (template === undefined) {
    template = await readFile(path.join(process.cwd(), 'prompts', `${name}.md`), 'utf8');
    if (process.env.NODE_ENV === 'production') cache.set(name, template);
  }
  return fillTemplate(template, vars);
}
