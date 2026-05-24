/**
 * HTML guard — detect raw HTML/markup leaking into user-facing text.
 *
 * Used to prevent raw HTML, error pages, and model markup from appearing
 * in chat messages, summary banners, or creation metadata.
 */

const HTML_PATTERNS = [
  /<!doctype/i,
  /<html/i,
  /<body/i,
  /<div/i,
  /<script/i,
  /<\/[a-z]/i,   // closing tags: </div>, </p>, </body> etc.
  /<head\b/i,
  /<style\b/i,
  /class=["'][^"']*["']/i,  // HTML class attribute
];

/**
 * Returns true if the value is a string that appears to contain raw HTML markup.
 * False for non-strings, empty strings, or plain text.
 */
export function containsHtmlLikeText(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return HTML_PATTERNS.some(p => p.test(value));
}
