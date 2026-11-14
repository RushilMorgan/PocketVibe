import 'server-only';
import { generateGrounded, generateJson, type GroundingSource } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import type { PromptContext } from '@/lib/profile';
import { whatIfDraft, type WhatIf, type WhatIfOrigin, type WhatIfSource } from './schema';
import { citeText, finishWhatIf, siteOf, sourceList } from './shape';

const CONTEXT_CHARS = 20_000;
const MAX_SOURCES = 12;

/**
 * Writes one what-if card (docs/what-if.md B2), in two calls because JSON
 * mode can't be combined with Search:
 *  1. Facts: a Search-grounded call (fast tier) on where things stand today.
 *     The sources are the pages Search actually read.
 *  2. The card: the user's smart model writes it from the save and the facts.
 * If the search fails or finds nothing the card is still written, without a
 * "Today" section.
 */
export async function generateWhatIf(input: {
  title: string;
  text: string;
  scenario: string;
  origin: WhatIfOrigin;
  ctx: PromptContext;
  modelId?: string;
}): Promise<WhatIf> {
  const { title, text, scenario, origin, ctx, modelId } = input;

  let notes = '';
  let sources: (WhatIfSource | null)[] = [];
  try {
    const facts = await generateGrounded(await prompt('whatif-facts', { scenario, title }), { feature: 'whatif_search' });
    sources = await Promise.all(facts.sources.slice(0, MAX_SOURCES).map(resolveSource));
    notes = citeText(facts.text, facts.supports);
  } catch (err) {
    console.error('whatif: search failed, writing without today', err);
  }

  const draft = await generateJson(
    whatIfDraft,
    [
      { text: await prompt('whatif', { ...ctx, scenario }) },
      { text: `Search notes on where things stand today:\n${notes || 'Nothing found.'}\n\nSources:\n${sourceList(sources) || '(none)'}` },
      { text: `What they saved — ${title}:\n${text.slice(0, CONTEXT_CHARS)}` },
    ],
    { feature: 'whatif', model: 'pro', modelId },
  );
  return finishWhatIf(draft, scenario, origin, sources);
}

/**
 * Search hands back Google redirect links. Reads where one points without
 * loading the page (many sites block bots). Null if it leads nowhere.
 */
async function resolveSource(source: GroundingSource): Promise<WhatIfSource | null> {
  try {
    const res = await fetch(source.uri, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HeyToolie/1.0)' },
      signal: AbortSignal.timeout(6_000),
    });
    await res.body?.cancel();
    const location = res.headers.get('location');
    const url = location ? new URL(location, source.uri).toString() : res.ok ? source.uri : null;
    const site = url ? siteOf(url) : null;
    // A link still on Google's redirect host expires, so it's no use as a source.
    if (!url || !site || /(^|\.)vertexaisearch\.cloud\.google\.com$/.test(site)) return null;
    return { url, site };
  } catch {
    return null;
  }
}
