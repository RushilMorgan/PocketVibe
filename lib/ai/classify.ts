import 'server-only';
import { z } from 'zod';
import { generateJson } from './gemini';
import { prompt } from './prompts';
import type { PromptContext } from '@/lib/profile';

export const classification = z.object({
  kind: z.enum(['recipe', 'tech', 'news', 'other']),
  title: z.string().min(1).max(200),
  tags: z.array(z.string().min(1).max(40)).min(1).max(5),
  has_structure: z.boolean(),
});

export type Classification = z.infer<typeof classification>;

/** Only the opening of the text is needed to tell what something is. */
const CLASSIFY_CHARS = 8_000;

export async function classify(text: string, ctx: PromptContext): Promise<Classification> {
  const instructions = await prompt('classifier', ctx);
  const result = await generateJson(classification, [
    { text: instructions },
    { text: `Content:\n${text.slice(0, CLASSIFY_CHARS)}` },
  ]);
  return { ...result, tags: [...new Set(result.tags.map((t) => t.trim().toLowerCase()))] };
}
