import 'server-only';
import { randomUUID } from 'node:crypto';
import { generateJson } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import { diagram, type Diagram } from '@/lib/handlers/schemas';
import { saveOutput } from '@/lib/items/service';
import type { PromptContext } from '@/lib/profile';
import { adminClient } from '@/lib/supabase/server';
import { getSmartModel } from '@/lib/users';
import { cleanMermaid, lintMermaid } from './clean';
import { parseError } from './parse';
import { renderPng } from './render';

const BUCKET = 'diagrams';
const CONTEXT_CHARS = 20_000;

/**
 * Asks Gemini for Mermaid, validates it (lint + mermaid.parse), and retries
 * once with the error attached. Null if it's still invalid: the item then
 * stays text-only rather than failing.
 */
export async function draftDiagram(text: string, ctx: PromptContext, modelId?: string): Promise<Diagram | null> {
  const instructions = await prompt('diagram', ctx);
  const content = { text: `Content:\n${text.slice(0, CONTEXT_CHARS)}` };

  let feedback: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = [{ text: instructions }, content];
    if (feedback) parts.push({ text: feedback });
    const draft = await generateJson(diagram, parts, { model: 'pro', modelId });
    const code = cleanMermaid(draft.mermaid);
    const problems = lintMermaid(code);
    const error = problems.length ? problems.join(' ') : await parseError(code);
    if (!error) return { mermaid: code, caption: draft.caption.trim() };
    feedback = `Your previous diagram was rejected: ${error}\nPrevious code:\n${code}\nFix it and return valid Mermaid.`;
    console.warn('diagram: attempt', attempt + 1, 'invalid:', error);
  }
  return null;
}

/**
 * Draft → render to PNG → upload to Storage → save as the item's diagram
 * output (replacing any earlier one and its file). Null if no usable diagram.
 */
export async function createDiagram(
  userId: string,
  itemId: string,
  text: string,
  ctx: PromptContext,
): Promise<{ content: Diagram; fileUrl: string } | null> {
  const draft = await draftDiagram(text, ctx, await getSmartModel(userId));
  if (!draft) return null;

  const png = await renderPng(draft.mermaid);
  const storage = adminClient().storage.from(BUCKET);
  const path = `${userId}/${itemId}/${randomUUID()}.png`;
  const { error } = await storage.upload(path, png, { contentType: 'image/png', cacheControl: '31536000' });
  if (error) throw error;
  const fileUrl = storage.getPublicUrl(path).data.publicUrl;

  const previous = await previousDiagramPath(userId, itemId);
  await saveOutput(userId, itemId, 'diagram', draft, fileUrl);
  if (previous) await storage.remove([previous]);
  return { content: draft, fileUrl };
}

async function previousDiagramPath(userId: string, itemId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from('item_outputs')
    .select('file_url')
    .eq('item_id', itemId)
    .eq('user_id', userId)
    .eq('type', 'diagram')
    .maybeSingle();
  if (error) throw error;
  const marker = `/${BUCKET}/`;
  const url = data?.file_url;
  return url?.includes(marker) ? url.slice(url.indexOf(marker) + marker.length) : null;
}
