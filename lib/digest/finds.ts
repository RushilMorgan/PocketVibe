import 'server-only';
import { z } from 'zod';
import { generateGrounded, generateJson } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import { normalizeUrl } from '@/lib/items/source';
import type { PromptContext } from '@/lib/profile';
import { isContentUrl, limitPerHost, parsePageMeta, titleFromSlug, type PageMeta } from './pages';
import type { Find } from './schema';

const PER_TOPIC = 3;
const MAX_CANDIDATES = 12;
const PER_HOST = 2;
const HTML_BYTES = 200_000;

interface Page extends PageMeta {
  url: string;
}

const picks = z.object({
  picks: z.array(z.object({ index: z.number().int().min(0), why: z.string().min(1).max(200) })).max(PER_TOPIC),
});

/**
 * "New for you", in three steps so every link is real and worth opening:
 *  1. Gemini + Google Search finds candidates. The pages Search actually read
 *     (grounding sources) come first; URLs the model typed are a fallback.
 *  2. Each candidate is fetched: redirects followed, dead pages and non-pages
 *     (home, search, tag, channel) dropped, title + description read.
 *  3. Flash picks up to 3 that are on-topic, substantial and varied.
 * Already-saved URLs (and ones picked for another topic) are skipped.
 */
export async function findsFor(
  topic: string,
  ctx: PromptContext,
  seen: Set<string>,
  /** Titles already picked for other topics this week, so the picks vary. */
  already: string[] = [],
): Promise<Find[]> {
  const exclude = [...seen].slice(0, 40).map((u) => `  - ${u}`).join('\n') || '  (nothing yet)';
  const { text, sources } = await generateGrounded(await prompt('finds', { ...ctx, topic, exclude }), { feature: 'digest' });

  const typed = [...text.matchAll(/https?:\/\/[^\s)\]>"'—]+/g)].map((m) => m[0].replace(/[.,;:]+$/, ''));
  const raw = [...new Set([...sources.map((s) => s.uri).filter(Boolean), ...typed])].slice(0, MAX_CANDIDATES * 2);

  const resolved = (await Promise.all(raw.map(resolvePage))).filter((p): p is Page => p !== null);
  const unique = [...new Map(resolved.map((p) => [p.url, p])).values()].filter((p) => !seen.has(p.url));
  const candidates = limitPerHost(unique, PER_HOST).slice(0, MAX_CANDIDATES);
  if (!candidates.length) return [];

  const list = candidates
    .map((p, i) => `[${i}] ${p.title}\n    ${new URL(p.url).hostname}\n    ${p.description.slice(0, 240)}`)
    .join('\n');
  const instructions = await prompt('finds-pick', {
    ...ctx,
    topic,
    already: already.length ? already.map((t) => `- ${t}`).join('\n') : '(nothing yet)',
  });
  const { picks: chosen } = await generateJson(picks, [{ text: instructions }, { text: list }], { feature: 'digest' });

  const out: Find[] = [];
  for (const { index, why } of chosen) {
    const page = candidates[index];
    if (!page || seen.has(page.url)) continue;
    seen.add(page.url);
    out.push({ title: page.title.slice(0, 160), url: page.url, why });
  }
  return out;
}

/**
 * Follows a candidate to the real page. Null if it's dead, not HTML, not a
 * specific page, or has no title. 401/403/429 pages exist but block bots, so
 * they're kept only if the URL itself looks like content (no title to read).
 */
async function resolvePage(raw: string): Promise<Page | null> {
  try {
    const res = await fetch(raw, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HeyToolie/1.0)', Accept: 'text/html' },
      signal: AbortSignal.timeout(8_000),
    });
    const url = normalizeUrl(res.url || raw);
    if (!url || !isContentUrl(url)) {
      await res.body?.cancel();
      return null;
    }
    if ([401, 403, 429].includes(res.status)) {
      await res.body?.cancel();
      const title = titleFromSlug(url);
      return title ? { url, title, description: '' } : null;
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) {
      await res.body?.cancel();
      return null;
    }
    const meta = parsePageMeta((await readHead(res)) ?? '');
    return meta.title ? { url, ...meta } : null;
  } catch {
    return null;
  }
}

/** Reads just enough of the page for its <head> (title and meta tags). */
async function readHead(res: Response): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let html = '';
  while (html.length < HTML_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  await reader.cancel();
  return html;
}
