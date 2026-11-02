/**
 * Pure helpers for judging candidate pages for "New for you". No I/O, so the
 * rules are unit-tested; finds.ts does the fetching.
 */

export interface PageMeta {
  title: string;
  description: string;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

function meta(html: string, key: string): string | null {
  // <meta property="og:title" content="…"> in either attribute order.
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i'));
  const value = a?.[1] ?? b?.[1];
  return value ? decode(value) : null;
}

/** Title and description from a page's <head>: Open Graph first, then <title>/description. */
export function parsePageMeta(html: string): PageMeta {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    title: meta(html, 'og:title') ?? (titleTag ? decode(titleTag) : ''),
    description: meta(html, 'og:description') ?? meta(html, 'description') ?? '',
  };
}

const NOT_CONTENT = [
  /^\/?$/, // home page
  /^\/(search|tag|tags|topic|topics|category|categories|author|authors|login|signup|subscribe)(\/|$)/i,
  /^\/results\b/i, // YouTube search
  /^\/(@[^/]+|c|channel|user)\/?[^/]*\/?$/i, // YouTube channel pages
];

/**
 * True if a URL looks like one specific article/video/doc, not a home page,
 * search, tag listing or profile — those make useless "finds".
 */
export function isContentUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (/(^|\.)(google|vertexaisearch\.cloud\.google)\.com$/i.test(url.hostname) && !/youtube/i.test(url.hostname)) return false;
  if (NOT_CONTENT.some((re) => re.test(url.pathname))) {
    // A YouTube watch page has path /watch and a ?v= — that's content.
    return /(^|\.)youtube\.com$/i.test(url.hostname) && url.pathname === '/watch' && url.searchParams.has('v');
  }
  return true;
}

/**
 * A readable title from a URL slug, for pages that block bots so their <title>
 * can't be read: drops IDs/hashes, de-hyphenates, capitalises. '' if the slug
 * is too short to mean anything.
 */
export function titleFromSlug(url: string): string {
  const slug = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '').replace(/\.\w{2,5}$/, '');
  const words = slug
    .split(/[-_+]+/)
    .filter((w) => w && !/^[0-9a-f]{8,}$/i.test(w) && !/^\d{5,}$/.test(w));
  if (words.length < 3) return '';
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Keeps the first `perHost` pages from each site, so one blog can't fill all
 * three slots for a topic.
 */
export function limitPerHost<T extends { url: string }>(pages: T[], perHost: number): T[] {
  const counts = new Map<string, number>();
  return pages.filter((p) => {
    const host = new URL(p.url).hostname.replace(/^www\./, '');
    const n = counts.get(host) ?? 0;
    counts.set(host, n + 1);
    return n < perHost;
  });
}
