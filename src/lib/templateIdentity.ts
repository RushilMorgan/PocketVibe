import type React from 'react';
import type { CreationType } from '../types';

/**
 * Per-template visual identity: each creation type gets its own accent
 * palette, emoji mark, and hero treatment so a cookbook never looks like a
 * budget spreadsheet. Renderers consume the palette through the `--tpl-*`
 * CSS variables (set on the canvas wrapper) via the `tpl-*` utility classes
 * in index.css — so they stay theme-correct wherever they're rendered.
 */
export interface TemplateIdentity {
  emoji: string;
  /** Short friendly type label, e.g. "Checklist". */
  label: string;
  /** One-line hero subtitle in Toolie's voice. */
  tagline: string;
  accent: string;
  /** Soft tint for chips and active backgrounds. */
  accentSoft: string;
  /** Border tint for outlined accents. */
  accentBorder: string;
  gradFrom: string;
  gradTo: string;
  /**
   * Whether the canvas shows the gradient CreationHero above the renderer.
   * Off for templates that already open with their own hero treatment
   * (landing page, tournament pool, idea board, recipes, workouts).
   */
  showHero: boolean;
}

const DEFAULT_IDENTITY: TemplateIdentity = {
  emoji: '✨',
  label: 'Tool',
  tagline: 'Made just for you',
  accent: '#7c3aed',
  accentSoft: '#f5f3ff',
  accentBorder: '#ddd6fe',
  gradFrom: '#7c3aed',
  gradTo: '#a855f7',
  showHero: true,
};

/**
 * Single source of truth for per-type visual identity. Exhaustively typed so
 * adding a CreationType fails the build until it has an identity here. The small
 * per-type maps in `creationTypeMeta.ts` (emoji/label/accent) are DERIVED from
 * this object — never hand-maintain a second copy.
 */
export const TEMPLATE_IDENTITIES: Record<CreationType, TemplateIdentity> = {
  checklist: {
    emoji: '✅',
    label: 'Checklist',
    tagline: 'Tick things off, one by one',
    accent: '#7c3aed',
    accentSoft: '#f5f3ff',
    accentBorder: '#ddd6fe',
    gradFrom: '#7c3aed',
    gradTo: '#a855f7',
    showHero: true,
  },
  habit_tracker: {
    emoji: '🔥',
    label: 'Habit tracker',
    tagline: 'Keep the streak alive',
    accent: '#0d9488',
    accentSoft: '#f0fdfa',
    accentBorder: '#99f6e4',
    gradFrom: '#0d9488',
    gradTo: '#10b981',
    showHero: true,
  },
  budget_calculator: {
    emoji: '💰',
    label: 'Budget',
    tagline: 'Know where your money goes',
    accent: '#059669',
    accentSoft: '#ecfdf5',
    accentBorder: '#a7f3d0',
    gradFrom: '#047857',
    gradTo: '#34d399',
    showHero: true,
  },
  savings_tracker: {
    emoji: '🎯',
    label: 'Savings goal',
    tagline: 'Watch it grow',
    accent: '#0284c7',
    accentSoft: '#f0f9ff',
    accentBorder: '#bae6fd',
    gradFrom: '#0369a1',
    gradTo: '#38bdf8',
    showHero: true,
  },
  landing_page: {
    emoji: '🚀',
    label: 'Landing page',
    tagline: 'Your idea, out in the world',
    accent: '#db2777',
    accentSoft: '#fdf2f8',
    accentBorder: '#fbcfe8',
    gradFrom: '#ec4899',
    gradTo: '#e11d48',
    showHero: false,
  },
  event_planner: {
    emoji: '🎉',
    label: 'Event plan',
    tagline: 'Everything sorted in time',
    accent: '#e11d48',
    accentSoft: '#fff1f2',
    accentBorder: '#fecdd3',
    gradFrom: '#e11d48',
    gradTo: '#fb7185',
    // The event planner opens with its own gradient header card
    showHero: false,
  },
  meal_planner: {
    emoji: '🍽️',
    label: 'Meal plan',
    tagline: 'Eat well all week',
    accent: '#ea580c',
    accentSoft: '#fff7ed',
    accentBorder: '#fed7aa',
    gradFrom: '#ea580c',
    gradTo: '#f59e0b',
    showHero: true,
  },
  workout_tracker: {
    emoji: '💪',
    label: 'Workout plan',
    tagline: 'Show up, log it, level up',
    accent: '#dc2626',
    accentSoft: '#fef2f2',
    accentBorder: '#fecaca',
    gradFrom: '#dc2626',
    gradTo: '#f97316',
    showHero: false,
  },
  price_calculator: {
    emoji: '🧮',
    label: 'Price calculator',
    tagline: 'Quote it right, every time',
    accent: '#4f46e5',
    accentSoft: '#eef2ff',
    accentBorder: '#c7d2fe',
    gradFrom: '#4f46e5',
    gradTo: '#818cf8',
    showHero: true,
  },
  task_planner: {
    emoji: '🗂️',
    label: 'Planner',
    tagline: 'One step at a time',
    accent: '#2563eb',
    accentSoft: '#eff6ff',
    accentBorder: '#bfdbfe',
    gradFrom: '#2563eb',
    gradTo: '#60a5fa',
    showHero: true,
  },
  tournament_pool_tracker: {
    emoji: '🏆',
    label: 'Tournament pool',
    tagline: 'May the best draw win',
    accent: '#ca8a04',
    accentSoft: '#fefce8',
    accentBorder: '#fef08a',
    gradFrom: '#eab308',
    gradTo: '#f97316',
    showHero: false,
  },
  idea_thinking_board: {
    emoji: '💡',
    label: 'Idea board',
    tagline: 'From spark to plan',
    accent: '#7c3aed',
    accentSoft: '#f5f3ff',
    accentBorder: '#ddd6fe',
    gradFrom: '#7c3aed',
    gradTo: '#6366f1',
    showHero: false,
  },
  recipe: {
    emoji: '🍳',
    label: 'Recipe',
    tagline: 'Cook it with confidence',
    // Rose — one recipe colour across hero, tool page, renderer and Ask-Toolie.
    accent: '#e11d48',
    accentSoft: '#fff1f2',
    accentBorder: '#fecdd3',
    gradFrom: '#f43f5e',
    gradTo: '#e11d48',
    showHero: false,
  },
  recipe_book: {
    emoji: '📖',
    label: 'Cookbook',
    tagline: 'Your recipes, all in one place',
    accent: '#e11d48',
    accentSoft: '#fff1f2',
    accentBorder: '#fecdd3',
    gradFrom: '#fb7185',
    gradTo: '#e11d48',
    showHero: false,
  },
};

export function getTemplateIdentity(creationType: string): TemplateIdentity {
  // Indexed by string (cloud rows store creation_type as plain text); unknown
  // types fall back to the default identity.
  return TEMPLATE_IDENTITIES[creationType as CreationType] ?? DEFAULT_IDENTITY;
}

/** CSS variables consumed by the `tpl-*` utility classes in index.css. */
export function templateCssVars(creationType: string): React.CSSProperties {
  const id = getTemplateIdentity(creationType);
  return {
    '--tpl-accent': id.accent,
    '--tpl-accent-soft': id.accentSoft,
    '--tpl-accent-border': id.accentBorder,
    '--tpl-grad-from': id.gradFrom,
    '--tpl-grad-to': id.gradTo,
  } as React.CSSProperties;
}
