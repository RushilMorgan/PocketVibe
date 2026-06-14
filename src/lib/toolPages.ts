/**
 * Standalone "tool page" registry.
 *
 * Each entry describes a shareable, SEO-friendly landing page for a single tool
 * (e.g. /tools/recipe-extractor). The recipe extractor is the first instance;
 * future catalog tools add a config object here and reuse the same `ToolPage`
 * shell — the only tool-specific code is the live interactive component, looked
 * up by `key` in ToolPage.
 *
 * This file is pure data (no React imports) so it can be read by the build/SEO
 * tooling and unit tests without pulling in the component tree.
 */

/** Per-type accent pair (Velix soft-accent treatment), from templateIdentity. */
export interface ToolAccent {
  accent: string;
  accentSoft: string;
}

/** One "How it works" step, rendered as a numbered card. */
export interface ToolGuideStep {
  icon: string;
  title: string;
  body: string;
}

/** A "Make it yours with Toolie" example — tapped to run live against the result. */
export interface ToolChip {
  /** Short button label, e.g. "Make it vegan". */
  label: string;
  /** The message actually sent to Toolie when tapped. */
  prompt: string;
}

/** An onward-path card in the "Where to go next" section. */
export interface ToolWhereNext {
  icon: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}

export interface ToolPageConfig {
  /** URL key — the page lives at `/tools/{key}`. */
  key: string;
  /** Key into TEMPLATE_IDENTITIES for emoji/accent/gradient. */
  identityKey: string;
  /** Canonical path used for <link rel=canonical> + share button. */
  canonicalPath: string;
  /** Tiny uppercase kicker above the title. */
  eyebrow: string;
  /** SEO + hero H1. */
  h1: string;
  /** One-line value proposition under the H1. */
  tagline: string;
  /** Real intro paragraph (also lives in the prerendered HTML for crawlers). */
  intro: string;
  /** 3-step "How it works". */
  steps: ToolGuideStep[];
  /** Lead-in copy for the customize section. */
  customizeIntro: string;
  /** Example Toolie prompts the user can tap to transform their result live. */
  chips: ToolChip[];
  /** Onward paths after the user has tried the tool. */
  whereNext: ToolWhereNext[];
}

export const TOOL_PAGES: Record<string, ToolPageConfig> = {
  'recipe-extractor': {
    key: 'recipe-extractor',
    identityKey: 'recipe',
    canonicalPath: '/tools/recipe-extractor',
    eyebrow: 'Free recipe tool',
    h1: 'Recipe Extractor',
    tagline: 'Paste any cooking video — get a clean, editable recipe.',
    intro:
      'Drop in a cooking-video link or paste a wall of recipe text, and Toolie pulls out a ' +
      'beginner-friendly recipe: a tidy ingredient checklist, clear numbered steps, and a ' +
      'ready-to-go shopping list. Then make it yours — scale the servings, swap ingredients, ' +
      'or go dairy-free — just by asking. No sign-up needed to try it.',
    steps: [
      {
        icon: '🔗',
        title: 'Paste a link or recipe text',
        body: 'A cooking-video URL, or any recipe you copied from anywhere.',
      },
      {
        icon: '✨',
        title: 'Toolie pulls out the recipe',
        body: 'Ingredients, step-by-step method, and a shopping list — instantly.',
      },
      {
        icon: '💬',
        title: 'Tweak it your way',
        body: 'Scale it, swap ingredients, simplify steps — just ask Toolie.',
      },
    ],
    customizeIntro:
      'This is where it gets powerful. Once your recipe is here, ask Toolie to change anything — ' +
      'tap an example below, talk to it with the mic, or edit any line by hand.',
    chips: [
      { label: '🍽️ Scale to 6 servings', prompt: 'Scale this recipe to 6 servings.' },
      { label: '🌱 Make it vegan', prompt: 'Make this recipe vegan, and note the swaps in the steps.' },
      { label: '📏 Switch to metric', prompt: 'Convert all the measurements to metric (g/ml).' },
      { label: '⏱️ What can I prep ahead?', prompt: 'What parts of this can I prep ahead of time?' },
      { label: '🥜 Make it nut-free', prompt: 'Make this recipe nut-free with safe substitutions.' },
    ],
    whereNext: [
      {
        icon: '📖',
        title: 'Save it to your cookbook',
        body: 'Create a free account to keep every recipe in one place, on any device.',
        href: '/',
        cta: 'Build a cookbook',
      },
      {
        icon: '🛠️',
        title: 'Build your own tool',
        body: 'Recipes are just the start. Tell Toolie what you need and it builds it.',
        href: '/',
        cta: 'Open Hey Toolie',
      },
    ],
  },
};

export function getToolPageConfig(key: string): ToolPageConfig | undefined {
  return TOOL_PAGES[key];
}
