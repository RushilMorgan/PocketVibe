/**
 * Smart share router — decides which tool a shared link/text should open in.
 *
 * Pure data + logic (no React, no DOM) so it can be unit-tested and read by the
 * /share landing without pulling in the component tree. The strategy is
 * deliberately AI-free: URL-pattern matching covers the high-frequency cases
 * (a YouTube cooking video → Recipe Extractor) with zero latency or quota cost.
 * The user always sees the full list and can override the top pick (Option 3).
 *
 * Adding a tool to the platform = add a TARGETS entry (and optionally a
 * URL_RULES line). Nothing else in the share flow needs to change.
 */

/** A destination the shared content can be routed into. */
export interface ShareTarget {
  /** `/tools/<key>` page key, or 'home' for the free-form Toolie composer. */
  key: string;
  label: string;
  emoji: string;
  /** One-line "what this does with your link". */
  blurb: string;
}

/** The normalised result of inspecting a share payload. */
export interface ShareSuggestion {
  /** First URL found in the payload (the `url` field, else parsed from text). */
  url: string | null;
  /** The raw shared text (may be empty). */
  text: string;
  /** Targets ordered best-guess-first; always ends with the 'home' fallback. */
  targets: ShareTarget[];
}

/** All routable targets, keyed by tool-page key. 'home' is the catch-all. */
const TARGETS: Record<string, ShareTarget> = {
  'recipe-extractor': {
    key: 'recipe-extractor',
    label: 'Recipe Extractor',
    emoji: '🍳',
    blurb: 'Pull a clean, editable recipe out of this video or page.',
  },
  'idea-board': {
    key: 'idea-board',
    label: 'Idea Board',
    emoji: '💡',
    blurb: 'Turn this into a thinking board to explore the idea.',
  },
  'meal-planner': {
    key: 'meal-planner',
    label: 'Meal Planner',
    emoji: '🥗',
    blurb: 'Build a meal plan around this.',
  },
  home: {
    key: 'home',
    label: 'Ask Toolie',
    emoji: '✨',
    blurb: 'Let Toolie decide what to build from this.',
  },
};

/** Default order of the non-matched tools (after the top pick, before 'home'). */
const DEFAULT_ORDER = ['recipe-extractor', 'idea-board', 'meal-planner'];

/**
 * URL-pattern rules → tool key. First match wins for the top suggestion.
 * The YouTube pattern mirrors the recipe pipeline's own ingestion regex.
 */
const URL_RULES: Array<{ test: RegExp; key: string }> = [
  // Cooking videos → recipe.
  { test: /(?:youtube\.com\/(?:shorts\/|watch\?|live\/)|youtu\.be\/)/i, key: 'recipe-extractor' },
  // Well-known recipe sites → recipe.
  {
    test: /\b(allrecipes|foodnetwork|bonappetit|seriouseats|cooking\.nytimes|tasty\.co|bbcgoodfood|delish|epicurious|simplyrecipes)\b/i,
    key: 'recipe-extractor',
  },
];

/** Pull the first http(s) URL out of a blob of shared text. */
function firstUrlIn(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

/**
 * Inspect a share payload and produce an ordered list of targets with the best
 * guess first. `url` is the dedicated share-target field; `text`/`title` are the
 * other two fields (some apps put the link only in `text`).
 */
export function routeShare(input: { url?: string | null; text?: string | null; title?: string | null }): ShareSuggestion {
  const text = (input.text ?? '').trim();
  const url = (input.url?.trim() || firstUrlIn(text) || firstUrlIn(input.title ?? '')) ?? null;

  // Find the top pick by URL rule (only meaningful when we have a URL).
  let topKey: string | null = null;
  if (url) {
    const hit = URL_RULES.find(rule => rule.test.test(url));
    if (hit) topKey = hit.key;
  }

  // Build the ordered key list: top pick → the rest of the catalog → home.
  const ordered: string[] = [];
  if (topKey) ordered.push(topKey);
  for (const key of DEFAULT_ORDER) {
    if (key !== topKey) ordered.push(key);
  }
  ordered.push('home');

  return {
    url,
    text,
    targets: ordered.map(key => TARGETS[key]),
  };
}
