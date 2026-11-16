import 'server-only';
import { generateJson } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import type { PromptContext } from '@/lib/profile';
import { extraction, pick, runDraft, type Framework, type FrameworkDraft, type RunContent } from './schema';
import { cleanFrameworks, finishRun, frameworkText, pickList, pickedIndexes } from './shape';

const CONTEXT_CHARS = 30_000;

/**
 * Pulls the reusable frameworks out of one save (docs/playbook.md). `existing`
 * is the names already in the playbook, so the same framework met again keeps
 * its name. Returns [] when the content teaches nothing reusable.
 */
export async function extractFrameworks(input: {
  title: string;
  text: string;
  existing: string[];
  ctx: PromptContext;
  modelId?: string;
}): Promise<FrameworkDraft[]> {
  const { title, text, existing, ctx, modelId } = input;
  const result = await generateJson(
    extraction,
    [
      { text: await prompt('frameworks', { ...ctx, existing: existing.length ? existing.join('; ') : 'nothing yet' }) },
      { text: `Content: ${title}\n\n${text.slice(0, CONTEXT_CHARS)}` },
    ],
    { feature: 'frameworks', model: 'pro', modelId },
  );
  return cleanFrameworks(result.frameworks);
}

/** The fast model chooses which of the playbook's frameworks fit the idea (at most 3; maybe none). */
export async function pickFrameworks<T extends Pick<Framework, 'name' | 'gist' | 'use_when'>>(idea: string, frameworks: T[]): Promise<T[]> {
  const result = await generateJson(
    pick,
    [{ text: await prompt('playbook-pick', {}) }, { text: `The idea:\n${idea}` }, { text: `The frameworks:\n${pickList(frameworks)}` }],
    { feature: 'playbook' },
  );
  return pickedIndexes(result.picks, frameworks.length).map((i) => frameworks[i]);
}

/** The smart model works the idea through the chosen frameworks. Throws if it used none of them. */
export async function applyFrameworks(input: {
  idea: string;
  frameworks: Framework[];
  ctx: PromptContext;
  modelId?: string;
}): Promise<RunContent> {
  const { idea, frameworks, ctx, modelId } = input;
  const draft = await generateJson(
    runDraft,
    [
      { text: await prompt('playbook-apply', ctx) },
      { text: `The idea:\n${idea}` },
      { text: `The frameworks:\n\n${frameworks.map((f, i) => frameworkText(f, i + 1)).join('\n\n')}` },
    ],
    { feature: 'playbook', model: 'pro', modelId },
  );
  const content = finishRun(draft, frameworks);
  if (!content) throw new Error('Playbook run used none of the frameworks it was given');
  return content;
}
