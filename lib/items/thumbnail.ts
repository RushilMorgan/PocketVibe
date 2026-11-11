/**
 * Pure helpers for finding an item's preview image (docs/saves-redesign.md A1).
 * We link to the source's own image rather than copying it. The network side
 * lives in `findThumbnail` in ./fetch.ts.
 */
import { youtubeVideoId } from './source';

/**
 * YouTube's own thumbnail, built from the video id with no request.
 *  - Shorts: `oar2.webp`, the real 1080×1920 portrait frame (~70–100KB). Their
 *    landscape thumbnails are the vertical frame between blurred side bars.
 *    `oar2` 404s for regular videos, so it's only used for /shorts/ links.
 *  - Everything else: `hqdefault.jpg` (480×360, exists for every video); it's
 *    4:3 with letterbox bars that a 16:9 `object-cover` crops away.
 */
export function youtubeThumbnail(url: string): string | null {
  const id = youtubeVideoId(url);
  if (!id) return null;
  return isYoutubeShort(url) ? `https://i.ytimg.com/vi_webp/${id}/oar2.webp` : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function isYoutubeShort(url: string): boolean {
  return new URL(url).pathname.startsWith('/shorts/');
}

/** TikTok's public oEmbed endpoint; its JSON has a `thumbnail_url` (a CDN link that expires). */
export function tiktokOembedUrl(url: string): string {
  return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
}

/** Preferred first: the explicit https variant, then the plain tags. */
const IMAGE_KEYS = ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'];

/**
 * The page's preview image from its `<meta>` tags, resolved against the page
 * URL. Attribute order and quoting vary between sites, so each tag's
 * attributes are read individually. Only http(s) results are returned.
 */
export function parseOgImage(html: string, pageUrl: string): string | null {
  const found = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = readAttributes(tag);
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
    const content = attrs.content?.trim();
    if (key && content && !found.has(key)) found.set(key, content);
  }
  for (const key of IMAGE_KEYS) {
    const value = found.get(key);
    if (!value) continue;
    try {
      const resolved = new URL(decodeEntities(value), pageUrl);
      if (resolved.protocol === 'https:' || resolved.protocol === 'http:') return resolved.toString();
    } catch {
      // Malformed URL in this tag; try the next key.
    }
  }
  return null;
}

function readAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
