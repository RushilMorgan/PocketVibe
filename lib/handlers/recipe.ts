import 'server-only';
import { generateJson, youtubePart } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import { HttpError } from '@/lib/http';
import { readPage } from '@/lib/items/fetch';
import { normalizeUrl, youtubeWatchUrl } from '@/lib/items/source';
import { recipe, type Recipe } from './schemas';

/**
 * The recipe handler (ported from the old pocketvibe-generate pipeline).
 * YouTube: Gemini watches the video, which catches quantities shown on screen.
 * Gemini's video input fails intermittently, so on any error it falls back to
 * the text we already have, exactly as the old extractor did.
 */
export async function extractRecipe(input: { url?: string; text: string; tone?: string }): Promise<Recipe> {
  const instructions = await prompt('recipe', { tone: input.tone ?? 'friendly' });
  const watchUrl = input.url ? safeWatchUrl(input.url) : null;

  if (watchUrl) {
    try {
      return await generateJson(recipe, [youtubePart(watchUrl), { text: instructions }], {
        feature: 'recipe',
        lowMediaResolution: true,
      });
    } catch (err) {
      console.warn('recipe: video extraction failed, falling back to text', err);
    }
  }
  if (!input.text.trim()) throw new Error('No recipe text to work from');
  return generateJson(recipe, [{ text: instructions }, { text: `Content:\n${input.text}` }], { feature: 'recipe' });
}

/**
 * The public /tools/recipe-extractor flow: a pasted link and/or recipe text.
 * For a link, the page text (incl. a YouTube description, which often holds
 * the recipe) is the fallback if watching the video fails.
 */
export async function extractRecipeFromInput(input: { url?: string; text?: string }): Promise<Recipe> {
  const url = input.url ? normalizeUrl(input.url) : null;
  if (input.url && !url) throw new HttpError(400, "That doesn't look like a link.");
  let text = input.text?.trim() ?? '';
  if (!text && url) text = await readPage(url).catch(() => '');
  if (!url && !text) throw new HttpError(400, 'Paste a link or the recipe text.');
  return extractRecipe({ url: url ?? undefined, text: text.slice(0, 60_000) });
}

function safeWatchUrl(url: string): string | null {
  try {
    return youtubeWatchUrl(url);
  } catch {
    return null;
  }
}
