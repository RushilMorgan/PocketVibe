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

  budget: {
    key: 'budget',
    identityKey: 'budget_calculator',
    canonicalPath: '/tools/budget',
    eyebrow: 'Free money tool',
    h1: 'Budget Calculator',
    tagline: 'See where your money goes — in one minute.',
    intro:
      'Tell Toolie your income and main expenses in plain English and get a clear monthly budget ' +
      'you can edit. Then trim costs, add a savings line, or switch to weekly just by asking. No ' +
      'sign-up needed to try it.',
    steps: [
      { icon: '✍️', title: 'Type your income & costs', body: 'Plain English — "I take home £2,400, rent is £950…".' },
      { icon: '💰', title: 'Toolie builds the budget', body: 'Income, expenses and the leftover, laid out clearly.' },
      { icon: '💬', title: 'Tweak it your way', body: 'Trim costs, add savings, or go weekly — just ask.' },
    ],
    customizeIntro: 'Your budget is fully editable. Tap an example below to reshape it, or edit any line by hand.',
    chips: [
      { label: '✂️ Trim expenses', prompt: 'Suggest where I could trim my expenses and apply it.' },
      { label: '💵 Add a savings line', prompt: 'Add a monthly savings line and adjust the budget to fit.' },
      { label: '📉 Cut spending 20%', prompt: 'Cut total spending by about 20% across the expenses.' },
      { label: '🔁 Make it weekly', prompt: 'Convert the whole budget to weekly amounts.' },
    ],
    whereNext: [
      { icon: '💾', title: 'Keep this budget', body: 'Create a free account to save it and track it over time.', href: '/', cta: 'Save it' },
      { icon: '🎯', title: 'Try the Savings Goal', body: 'Set a target and watch your progress grow.', href: '/tools/savings', cta: 'Open' },
    ],
  },

  savings: {
    key: 'savings',
    identityKey: 'savings_tracker',
    canonicalPath: '/tools/savings',
    eyebrow: 'Free money tool',
    h1: 'Savings Goal Tracker',
    tagline: 'Set a goal and watch it grow.',
    intro:
      'Tell Toolie what you are saving for and get a clean savings tracker with a target, an ' +
      'optional deadline, and room to log every contribution. Then raise the target or set a ' +
      'deadline just by asking. No sign-up needed to try it.',
    steps: [
      { icon: '🎯', title: 'Name your goal', body: '"Save £3,000 for a trip to Japan by December".' },
      { icon: '📊', title: 'Toolie sets it up', body: 'A target, a progress bar, and a place to log savings.' },
      { icon: '💬', title: 'Tweak it your way', body: 'Set a deadline, raise the target — just ask.' },
    ],
    customizeIntro: 'Your tracker is fully editable. Tap an example below to reshape it, or edit it by hand.',
    chips: [
      { label: '📅 Set a deadline', prompt: 'Set a realistic deadline for this goal.' },
      { label: '⬆️ Raise the target', prompt: 'Raise the target amount by a sensible amount.' },
      { label: '📈 Monthly amount', prompt: 'Suggest how much I need to save each month to hit this.' },
      { label: '🎯 Make it realistic', prompt: 'Make this goal more realistic for an average budget.' },
    ],
    whereNext: [
      { icon: '💾', title: 'Keep this goal', body: 'Create a free account to save it and log progress.', href: '/', cta: 'Save it' },
      { icon: '💰', title: 'Try the Budget Calculator', body: 'See where your money goes each month.', href: '/tools/budget', cta: 'Open' },
    ],
  },

  workout: {
    key: 'workout',
    identityKey: 'workout_tracker',
    canonicalPath: '/tools/workout',
    eyebrow: 'Free fitness tool',
    h1: 'Workout Plan',
    tagline: 'A weekly plan that fits your goal and gear.',
    intro:
      'Tell Toolie your goal, how many days a week, and what equipment you have, and get a ' +
      'realistic weekly workout plan you can follow and log. Then make it harder, shorter, or ' +
      'equipment-free just by asking. No sign-up needed to try it.',
    steps: [
      { icon: '🎯', title: 'Set your goal', body: '"Get stronger, 3 days a week, dumbbells at home".' },
      { icon: '🏋️', title: 'Toolie builds the plan', body: 'A realistic weekly structure for your level.' },
      { icon: '💬', title: 'Tweak it your way', body: 'Harder, shorter, no equipment — just ask.' },
    ],
    customizeIntro: 'Your plan is fully editable. Tap an example below to reshape it, or edit it by hand.',
    chips: [
      { label: '🏠 No equipment', prompt: 'Rework the plan to need no equipment.' },
      { label: '⏱️ 30-min sessions', prompt: 'Make every session 30 minutes or less.' },
      { label: '💪 Make it harder', prompt: 'Make the whole plan more challenging.' },
      { label: '🗓️ 3 days a week', prompt: 'Rework it for just 3 days a week.' },
    ],
    whereNext: [
      { icon: '💾', title: 'Keep this plan', body: 'Create a free account to save it and log sessions.', href: '/', cta: 'Save it' },
      { icon: '🍽️', title: 'Try the Meal Planner', body: 'A week of meals and a grocery list.', href: '/tools/meal-planner', cta: 'Open' },
    ],
  },

  'event-planner': {
    key: 'event-planner',
    identityKey: 'event_planner',
    canonicalPath: '/tools/event-planner',
    eyebrow: 'Free planning tool',
    h1: 'Event Planner',
    tagline: 'Everything sorted, in good time.',
    intro:
      'Tell Toolie what you are planning and get an event plan with a clear checklist of tasks to ' +
      'get ready in good time. Then add a timeline, plan for more guests, or keep it simple just by ' +
      'asking. No sign-up needed to try it.',
    steps: [
      { icon: '✍️', title: 'Describe the event', body: '"A 6th birthday party for 15 kids, three weeks away".' },
      { icon: '✅', title: 'Toolie builds the plan', body: 'A checklist of everything to sort, in order.' },
      { icon: '💬', title: 'Tweak it your way', body: 'Add a timeline, more guests, or simplify — just ask.' },
    ],
    customizeIntro: 'Your plan is fully editable. Tap an example below to reshape it, or tick tasks off by hand.',
    chips: [
      { label: '⏳ Add a timeline', prompt: 'Add a week-by-week timeline to the tasks.' },
      { label: '🛒 Add a shopping list', prompt: 'Add a shopping list of what to buy.' },
      { label: '👥 More guests', prompt: 'Re-plan this for roughly double the guests.' },
      { label: '✂️ Keep it simple', prompt: 'Simplify the plan to the essentials only.' },
    ],
    whereNext: [
      { icon: '💾', title: 'Keep this plan', body: 'Create a free account to save it and tick tasks off.', href: '/', cta: 'Save it' },
      { icon: '🍽️', title: 'Try the Meal Planner', body: 'Plan the food for the week too.', href: '/tools/meal-planner', cta: 'Open' },
    ],
  },

  price: {
    key: 'price',
    identityKey: 'price_calculator',
    canonicalPath: '/tools/price',
    eyebrow: 'Free business tool',
    h1: 'Price Calculator',
    tagline: 'Quote it right, every time.',
    intro:
      'Tell Toolie what you charge for and get a tidy quote calculator with line items and an ' +
      'optional tax rate. Then add items, offer a discount, or bundle pricing just by asking. No ' +
      'sign-up needed to try it.',
    steps: [
      { icon: '✍️', title: 'Describe what you charge for', body: '"Garden clearance — call-out, labour, disposal".' },
      { icon: '🧾', title: 'Toolie builds the quote', body: 'Line items, totals and an optional tax rate.' },
      { icon: '💬', title: 'Tweak it your way', body: 'Add items, discounts, or bundles — just ask.' },
    ],
    customizeIntro: 'Your calculator is fully editable. Tap an example below to reshape it, or edit any line by hand.',
    chips: [
      { label: '➕ Add a line item', prompt: 'Add another sensible line item.' },
      { label: '💸 Offer a discount', prompt: 'Add a discount line that takes 10% off.' },
      { label: '🧾 Add tax', prompt: 'Add a sensible tax rate to the quote.' },
      { label: '📦 Bundle pricing', prompt: 'Suggest a bundled package price for everything.' },
    ],
    whereNext: [
      { icon: '💾', title: 'Keep this calculator', body: 'Create a free account to save it and reuse it.', href: '/', cta: 'Save it' },
      { icon: '💡', title: 'Try the Idea Board', body: 'Pressure-test the business idea behind it.', href: '/tools/idea-board', cta: 'Open' },
    ],
  },
};

export function getToolPageConfig(key: string): ToolPageConfig | undefined {
  return TOOL_PAGES[key];
}
