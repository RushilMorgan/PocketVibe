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

  'idea-board': {
    key: 'idea-board',
    identityKey: 'idea_thinking_board',
    canonicalPath: '/tools/idea-board',
    eyebrow: 'Free idea tool',
    h1: 'Idea Brainstorm Board',
    tagline: 'Turn a rough idea into a clear, visual plan.',
    intro:
      'Describe your idea in a sentence and Toolie maps it out — who it is for, the problem ' +
      'it solves, the risks, ways it could make money, a health score, and what to build first. ' +
      'Then reshape any part of it just by asking. No sign-up needed to try it.',
    steps: [
      {
        icon: '✍️',
        title: 'Describe your idea',
        body: 'One or two sentences — an app, a business, a side hustle, anything.',
      },
      {
        icon: '🧠',
        title: 'Toolie maps it out',
        body: 'Target users, risks, money ideas, a health score and a visual map.',
      },
      {
        icon: '💬',
        title: 'Reshape any card',
        body: 'Tap a card — or an example below — to rethink that part, live.',
      },
    ],
    customizeIntro:
      'Your board is fully live. Tap any card to talk to it, or try an example below — Toolie ' +
      'reshapes just that part in place, without disturbing the rest.',
    chips: [
      { label: '👤 Who is this for?', prompt: 'Sharpen who this is for and why they would care.' },
      { label: '⚠️ Biggest risks?', prompt: 'Add the biggest risks I should worry about.' },
      { label: '💰 Make money?', prompt: 'Suggest realistic ways this could make money.' },
      { label: '🛠️ Build first?', prompt: 'Suggest the very first thing I should build to test this.' },
      { label: '✂️ Make it simpler', prompt: 'Simplify the idea down to its strongest core.' },
    ],
    whereNext: [
      {
        icon: '💾',
        title: 'Save your board',
        body: 'Create a free account to keep it and come back to it anytime.',
        href: '/',
        cta: 'Save it',
      },
      {
        icon: '🍳',
        title: 'Try the Recipe Extractor',
        body: 'Another free tool — paste a cooking video, get a clean recipe.',
        href: '/tools/recipe-extractor',
        cta: 'Open',
      },
    ],
  },

  'meal-planner': {
    key: 'meal-planner',
    identityKey: 'meal_planner',
    canonicalPath: '/tools/meal-planner',
    eyebrow: 'Free meal tool',
    h1: 'Meal Planner',
    tagline: 'A week of meals and a grocery list, in seconds.',
    intro:
      'Tell Toolie who is eating and any preferences, and get a practical 7-day meal plan plus a ' +
      'consolidated grocery list. Then make it vegetarian, cheaper, or quicker just by asking. ' +
      'No sign-up needed to try it.',
    steps: [
      {
        icon: '👨‍👩‍👧',
        title: "Say who's eating",
        body: 'How many people, and any preferences or dietary needs.',
      },
      {
        icon: '🗓️',
        title: 'Toolie plans the week',
        body: 'A varied 7-day plan plus a grocery list, instantly.',
      },
      {
        icon: '💬',
        title: 'Tweak it your way',
        body: 'Vegetarian, cheaper, quicker — just ask Toolie.',
      },
    ],
    customizeIntro:
      'Your plan is fully editable. Tap an example below to reshape the whole week, or edit any ' +
      'meal and the grocery list by hand.',
    chips: [
      { label: '🥦 Make it vegetarian', prompt: 'Make the whole week vegetarian and update the grocery list.' },
      { label: '💸 Cheaper meals', prompt: 'Swap in cheaper, budget-friendly meals across the week.' },
      { label: '⚡ Quicker dinners', prompt: 'Make the dinners quicker — 30 minutes or less.' },
      { label: '🍱 Add lunches', prompt: 'Add a lunch for every day too.' },
      { label: '🔁 Less repetition', prompt: 'Make the week more varied with less repetition.' },
    ],
    whereNext: [
      {
        icon: '💾',
        title: 'Save your week',
        body: 'Create a free account to keep your plan and grocery list.',
        href: '/',
        cta: 'Save it',
      },
      {
        icon: '🍳',
        title: 'Try the Recipe Extractor',
        body: 'Turn any cooking video into a clean, editable recipe.',
        href: '/tools/recipe-extractor',
        cta: 'Open',
      },
    ],
  },
};

export function getToolPageConfig(key: string): ToolPageConfig | undefined {
  return TOOL_PAGES[key];
}
