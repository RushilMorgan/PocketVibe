/**
 * Single source of truth for per-creation-type metadata (emoji, label, accent).
 *
 * The maps are typed Record<CreationType, …> on purpose: adding a type to the
 * union breaks the build here until every map has an entry. ALL_CREATION_TYPES
 * exposes the same list at runtime so the drift test can assert the edge
 * functions / validator / renderer stay in sync too.
 */
import type { CreationType } from '../types';

export const TYPE_EMOJI: Record<CreationType, string> = {
  checklist: '✅',
  habit_tracker: '🔁',
  budget_calculator: '💰',
  savings_tracker: '💸',
  landing_page: '🌐',
  event_planner: '🎉',
  meal_planner: '🍽️',
  workout_tracker: '💪',
  price_calculator: '🧾',
  task_planner: '📌',
  tournament_pool_tracker: '🏆',
  idea_thinking_board: '💡',
  recipe: '🍳',
  recipe_book: '📖',
};

export const TYPE_LABEL: Record<CreationType, string> = {
  checklist: 'Checklist',
  habit_tracker: 'Habit tracker',
  budget_calculator: 'Budget',
  savings_tracker: 'Savings goal',
  landing_page: 'Landing page',
  event_planner: 'Event planner',
  meal_planner: 'Meal planner',
  workout_tracker: 'Workout plan',
  price_calculator: 'Price calculator',
  task_planner: 'Task planner',
  tournament_pool_tracker: 'Tournament pool',
  idea_thinking_board: 'Idea board',
  recipe: 'Recipe',
  recipe_book: 'Cookbook',
};

export const TYPE_ACCENT: Record<CreationType, string> = {
  checklist: '#7c3aed',
  habit_tracker: '#f97316',
  budget_calculator: '#16a34a',
  savings_tracker: '#0ea5e9',
  landing_page: '#ec4899',
  event_planner: '#f43f5e',
  meal_planner: '#14b8a6',
  workout_tracker: '#ef4444',
  price_calculator: '#8b5cf6',
  task_planner: '#6366f1',
  tournament_pool_tracker: '#f59e0b',
  idea_thinking_board: '#7c3aed',
  recipe: '#e11d48',
  recipe_book: '#e11d48',
};

/** Every creation type, derived from the exhaustively-typed map above. */
export const ALL_CREATION_TYPES = Object.keys(TYPE_LABEL) as CreationType[];

/** String-friendly lookups (cloud rows store creation_type as plain text). */
export function typeEmoji(type: string): string {
  return TYPE_EMOJI[type as CreationType] ?? '🔧';
}
export function typeLabel(type: string): string {
  return TYPE_LABEL[type as CreationType] ?? 'Tool';
}
