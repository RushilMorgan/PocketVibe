import 'server-only';
import { generateText, youtubePart } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import type { ItemSource } from '@/lib/supabase/database.types';
import { z } from 'zod';
import { parseLengthSeconds, youtubeWatchUrl } from './source';
import { parseOgImage, tiktokOembedUrl, youtubeThumbnail } from './thumbnail';

/** Enough for a long article; keeps classify/explain calls cheap. */
const MAX_CHARS = 60_000;

export class UnreadableError extends Error {}

export interface FetchedContent {
  text: string;
  /** YouTube only; null when the length couldn't be read. */
  durationSeconds: number | null;
}

/**
 * Turns a link into plain text every later step can work from.
 *  - YouTube: Gemini watches the video and writes a transcript-style digest.
 *  - Everything else: Jina Reader's readability extraction (TikTok/Instagram
 *    give caption + page text only — see SPEC "out of scope").
 */
export async function fetchContent(url: string, source: ItemSource): Promise<FetchedContent> {
  const { text, durationSeconds } =
    source === 'youtube' ? await digestVideo(url) : { text: await readPage(url), durationSeconds: null };
  if (text.trim().length < 80) throw new UnreadableError('There was almost no text to work with.');
  return { text: text.slice(0, MAX_CHARS), durationSeconds };
}

/** SPEC guardrail: long videos cost too much to watch in full. */
const MAX_VIDEO_SECONDS = 20 * 60;

async function digestVideo(url: string): Promise<FetchedContent> {
  const watchUrl = youtubeWatchUrl(url);
  if (!watchUrl) throw new UnreadableError("That YouTube link isn't a video.");
  const seconds = await videoLengthSeconds(watchUrl);
  if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
    throw new UnreadableError("That video's over 20 minutes — HeyToolie only reads shorter ones for now.");
  }
  const instructions = await prompt('video-digest', {});
  const text = await generateText([youtubePart(watchUrl), { text: instructions }], { feature: 'watch', lowMediaResolution: true });
  return { text, durationSeconds: seconds };
}

/**
 * Video length from the watch page's embedded player data (no API key needed).
 * Null when it can't be read — the guard is best-effort, never a blocker.
 */
async function videoLengthSeconds(watchUrl: string): Promise<number | null> {
  try {
    const res = await fetch(watchUrl, {
      headers: { 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8_000),
    });
    return parseLengthSeconds(await res.text());
  } catch {
    return null;
  }
}

const UA = 'Mozilla/5.0 (compatible; HeyToolie/1.0; +https://heytoolie.com)';
/** The <head> is nearly always inside this; stops a huge page being read in full. */
const HEAD_BYTES = 64 * 1024;
const oembed = z.object({ thumbnail_url: z.url() });

/**
 * The source's own preview image, or null (docs/saves-redesign.md A1).
 * YouTube needs no request; TikTok uses oEmbed; anything else reads og:image
 * from the page head. Throws on network errors — callers treat it as best-effort.
 */
export async function findThumbnail(url: string, source: ItemSource): Promise<string | null> {
  if (source === 'youtube') return youtubeThumbnail(url);
  if (source === 'tiktok') {
    const res = await fetch(tiktokOembedUrl(url), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return null;
    const parsed = oembed.safeParse(await res.json());
    return parsed.success ? parsed.data.thumbnail_url : null;
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok || !res.body || !/html/i.test(res.headers.get('content-type') ?? '')) return null;
  return parseOgImage(await readHead(res.body), res.url || url);
}

async function readHead(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  let bytes = 0;
  try {
    while (bytes < HEAD_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return html;
}

export async function readPage(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new UnreadableError(`The page wouldn't load (${res.status}).`);
  return res.text();
}
