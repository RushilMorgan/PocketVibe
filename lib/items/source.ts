import type { ItemSource } from '@/lib/supabase/database.types';

const YOUTUBE = /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)$/i;
const TIKTOK = /(?:^|\.)tiktok\.com$/i;
const SOCIAL = /(?:^|\.)(?:instagram\.com|facebook\.com|x\.com|twitter\.com|threads\.net)$/i;

/**
 * Pulls the shared link out of a share-sheet payload. Android apps are
 * inconsistent: some fill `url`, others put "Title https://…" in `text`.
 */
export function extractUrl(payload: { url?: string | null; text?: string | null; title?: string | null }): string | null {
  for (const candidate of [payload.url, payload.text, payload.title]) {
    const match = candidate?.match(/https?:\/\/[^\s<>"']+/i);
    if (match) return normalizeUrl(match[0]);
  }
  return null;
}

/** Trims trailing punctuation and tracking params so re-shares dedupe cleanly. */
export function normalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.replace(/[).,!?]+$/, ''));
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|igsh$|si$|feature$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.toString();
}

/**
 * Canonical watch URL for any YouTube link (Shorts, youtu.be, live, mobile) —
 * the form Gemini accepts as video input. Null if no video id is present.
 */
export function youtubeWatchUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** The video id from any YouTube link form, or null. */
export function youtubeVideoId(url: string): string | null {
  const u = new URL(url);
  const id = u.hostname.endsWith('youtu.be')
    ? u.pathname.slice(1)
    : (u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1]);
  return id && /^[\w-]{6,}$/.test(id) ? id : null;
}

/** Reads `"lengthSeconds":"123"` out of a YouTube watch page. */
export function parseLengthSeconds(html: string): number | null {
  const match = html.match(/"lengthSeconds":"(\d+)"/);
  return match ? Number(match[1]) : null;
}

export function detectSource(url: string): ItemSource {
  const host = new URL(url).hostname;
  if (YOUTUBE.test(host)) return 'youtube';
  if (TIKTOK.test(host)) return 'tiktok';
  if (SOCIAL.test(host)) return 'other';
  return 'article';
}
