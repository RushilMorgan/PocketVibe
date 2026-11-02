import 'server-only';
import { generateGrounded } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import { normalizeUrl } from '@/lib/items/source';
import type { PromptContext } from '@/lib/profile';
import { extractJsonArray, find, type Find } from './schema';

const PER_TOPIC = 3;

/**
 * "New for you": Gemini with Google Search grounding suggests pages on a
 * topic. Model-written URLs can be wrong, so each is fetched and dropped if
 * dead; grounding redirect links are resolved to the real page. Anything the
 * user already saved (or was already picked this week) is skipped.
 */
export async function findsFor(topic: string, ctx: PromptContext, seen: Set<string>): Promise<Find[]> {
  const exclude = [...seen].slice(0, 40).map((u) => `  - ${u}`).join('\n') || '  (nothing yet)';
  const text = await generateGrounded(await prompt('finds', { ...ctx, topic, exclude }));

  const candidates = extractJsonArray(text).flatMap((raw) => {
    const parsed = find.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });

  const results: Find[] = [];
  for (const candidate of candidates) {
    if (results.length === PER_TOPIC) break;
    const url = await liveUrl(candidate.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    results.push({ ...candidate, url });
  }
  return results;
}

/**
 * The final, normalised URL if the page exists. 401/403/429 count as alive
 * (the page is there, it just blocks bots); 404s and network errors don't.
 */
async function liveUrl(raw: string): Promise<string | null> {
  try {
    const res = await fetch(raw, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HeyToolie/1.0)' },
      signal: AbortSignal.timeout(8_000),
    });
    await res.body?.cancel();
    if (res.status >= 400 && ![401, 403, 429].includes(res.status)) return null;
    return normalizeUrl(res.url || raw);
  } catch {
    return null;
  }
}
