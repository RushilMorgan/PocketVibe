import 'server-only';
import { generateText, youtubePart } from '@/lib/ai/gemini';
import { prompt } from '@/lib/ai/prompts';
import type { ItemSource } from '@/lib/supabase/database.types';
import { parseLengthSeconds, youtubeWatchUrl } from './source';

/** Enough for a long article; keeps classify/explain calls cheap. */
const MAX_CHARS = 60_000;

export class UnreadableError extends Error {}

/**
 * Turns a link into plain text every later step can work from.
 *  - YouTube: Gemini watches the video and writes a transcript-style digest.
 *  - Everything else: Jina Reader's readability extraction (TikTok/Instagram
 *    give caption + page text only — see SPEC "out of scope").
 */
export async function fetchContent(url: string, source: ItemSource): Promise<string> {
  const text = source === 'youtube' ? await digestVideo(url) : await readPage(url);
  if (text.trim().length < 80) throw new UnreadableError('There was almost no text to work with.');
  return text.slice(0, MAX_CHARS);
}

/** SPEC guardrail: long videos cost too much to watch in full. */
const MAX_VIDEO_SECONDS = 20 * 60;

async function digestVideo(url: string): Promise<string> {
  const watchUrl = youtubeWatchUrl(url);
  if (!watchUrl) throw new UnreadableError("That YouTube link isn't a video.");
  const seconds = await videoLengthSeconds(watchUrl);
  if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
    throw new UnreadableError("That video's over 20 minutes — HeyToolie only reads shorter ones for now.");
  }
  const instructions = await prompt('video-digest', {});
  return generateText([youtubePart(watchUrl), { text: instructions }], { lowMediaResolution: true });
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

export async function readPage(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new UnreadableError(`The page wouldn't load (${res.status}).`);
  return res.text();
}
