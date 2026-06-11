/**
 * Derive a video thumbnail straight from a pasted YouTube link — YouTube
 * serves predictable thumbnail URLs for every video, so recipe cards get
 * real imagery with zero API calls and zero cost. Non-YouTube links simply
 * return null and the UI falls back to a dish emoji tile.
 */

const ID_PATTERNS: RegExp[] = [
  /youtu\.be\/([\w-]{6,})/i,
  /youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/)([\w-]{6,})/i,
];

export function getYouTubeVideoId(url: string): string | null {
  for (const re of ID_PATTERNS) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

export function youtubeThumbnailUrl(url: string): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
