/**
 * Normalize and sanitize a GenerateResponse before saving.
 *
 * Ensures:
 *  - generative_html is never saved (returns null → caller uses offline fallback)
 *  - creationType matches content.type (mismatched response → null)
 *  - HTML is stripped from title, description, and summary
 */
import type { GenerateResponse, GenerateRequest } from '../types';
import { containsHtmlLikeText } from './htmlGuard';

const SAFE_SUMMARY_FALLBACK = 'I made this for you. You can edit it below.';

export function normalizeGenerateResponse(
  res: GenerateResponse,
  _req: GenerateRequest,
): GenerateResponse | null {
  // 1. Reject unsupported types — generative_html and any other legacy type must never be saved
  const typeStr = res.creationType as string;
  const contentTypeStr = (res.content as { type: string }).type;
  if (typeStr === 'generative_html' || contentTypeStr === 'generative_html') {
    return null;
  }

  // 2. Reject mismatched content.type / creationType
  if (res.content.type !== res.creationType) {
    console.warn('[HeyToolie] creationType mismatch:', res.creationType, '!==', res.content.type);
    return null;
  }

  let normalized: GenerateResponse = { ...res };

  // 3. Strip HTML from user-visible text fields
  if (containsHtmlLikeText(normalized.title)) {
    console.warn('[HeyToolie] HTML detected in title — replacing');
    normalized = { ...normalized, title: 'Your creation' };
  }
  if (containsHtmlLikeText(normalized.description)) {
    normalized = { ...normalized, description: '' };
  }
  if (containsHtmlLikeText(normalized.summary)) {
    console.warn('[HeyToolie] HTML detected in summary — replacing');
    normalized = { ...normalized, summary: SAFE_SUMMARY_FALLBACK };
  }

  return normalized;
}
