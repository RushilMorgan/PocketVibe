/**
 * Capability registry — what each renderer actually supports.
 *
 * This is the source of truth for what users can DO in each creation type.
 * It is used to:
 *   1. Intercept requests asking for abilities the renderer does not have.
 *   2. Give honest user-facing feedback instead of pretending AI did something.
 *
 * NOTE: if you add editor controls to a renderer, update this registry.
 */
import type { CreationType } from '../types';

export type CreationCapability =
  // Habit tracker
  | 'toggle_completion'
  | 'edit_habit_names'
  | 'edit_habit_icons'
  | 'add_habit'
  | 'delete_habit'
  // Checklist
  | 'toggle_items'
  | 'edit_item_labels'
  | 'add_items'
  | 'delete_items'
  | 'add_sections'
  // Budget calculator
  | 'edit_amounts'
  | 'edit_labels'
  | 'edit_categories'
  | 'edit_currency'
  | 'edit_notes'
  | 'add_income'
  | 'add_expense'
  | 'delete_income'
  | 'delete_expense'
  // Savings tracker
  | 'add_contribution'
  | 'edit_goal_name'
  | 'edit_goal_details'
  | 'delete_contributions'
  | 'edit_contributions'
  // Landing page / shared
  | 'edit_page_fields'
  // Workout tracker challenge mode
  | 'log_activity'
  | 'edit_participants'
  | 'edit_scoring_rules';

/**
 * Direct-edit capabilities that each renderer provides.
 * Types not listed here (or with an empty array) have NO direct editing support yet.
 */
const RENDERER_CAPABILITIES: Record<string, CreationCapability[]> = {
  habit_tracker: [
    'toggle_completion',
    'edit_habit_names',
    'edit_habit_icons',
    'add_habit',
    'delete_habit',
  ],
  checklist: ['toggle_items', 'edit_item_labels', 'add_items', 'delete_items', 'add_sections'],
  budget_calculator: [
    'edit_amounts',
    'edit_labels',
    'edit_categories',
    'edit_currency',
    'edit_notes',
    'add_income',
    'add_expense',
    'delete_income',
    'delete_expense',
  ],
  savings_tracker: [
    'add_contribution',
    'edit_goal_name',
    'edit_goal_details',
    'delete_contributions',
    'edit_contributions',
  ],
  event_planner: ['edit_labels', 'add_items', 'delete_items', 'toggle_items'],
  meal_planner: ['edit_labels', 'add_items', 'delete_items'],
  workout_tracker: ['edit_labels', 'add_items', 'delete_items', 'log_activity', 'edit_participants', 'edit_scoring_rules'],
  price_calculator: [
    'edit_amounts',
    'edit_labels',
    'edit_categories',
    'add_items',
    'delete_items',
    'edit_currency',
    'edit_notes',
  ],
  task_planner: ['edit_labels', 'add_items', 'delete_items', 'toggle_items'],
  landing_page: ['edit_page_fields', 'edit_labels'],
  tournament_pool_tracker: ['edit_labels', 'add_items', 'delete_items', 'log_activity', 'edit_participants', 'edit_scoring_rules'],
  idea_thinking_board: ['edit_labels', 'add_items', 'delete_items', 'edit_notes'],
  recipe: ['toggle_items', 'edit_labels', 'add_items', 'delete_items', 'edit_notes'],
  recipe_book: ['toggle_items', 'edit_labels', 'add_items', 'delete_items', 'edit_notes'],
};

export function getSupportedCapabilities(type: CreationType): CreationCapability[] {
  return (RENDERER_CAPABILITIES[type] ?? []) as CreationCapability[];
}

/**
 * Returns true when the user is asking for direct editing on a type whose
 * renderer has zero editing support. In this case we should respond honestly
 * instead of calling the AI (which would change nothing visible).
 */
export function isEditRequestOnNonEditableType(
  userRequest: string,
  creationType: CreationType,
): boolean {
  const supported = getSupportedCapabilities(creationType);
  if (supported.length > 0) return false; // renderer has some edit support
  return /\b(edit|editable|changeable|modifiable|rename|directly (edit|change))\b/i.test(userRequest);
}

/**
 * Returns true when the user is asking for direct-edit CAPABILITY on a type
 * whose renderer already supports it. We can short-circuit the AI call and
 * direct the user to the built-in controls instead.
 */
export function isRendererAlreadyEditable(
  userRequest: string,
  creationType: CreationType,
): boolean {
  const supported = getSupportedCapabilities(creationType);
  // Only meaningful when the renderer has comprehensive edit support
  const fullyEditable: CreationType[] = [
    'habit_tracker',
    'budget_calculator',
    'savings_tracker',
    'price_calculator',
    'event_planner',
    'meal_planner',
    'workout_tracker',
    'task_planner',
    'landing_page',
    'checklist',
    'tournament_pool_tracker',
    'idea_thinking_board',
    'recipe',
    'recipe_book',
  ];
  if (!fullyEditable.includes(creationType)) return false;
  if (supported.length < 3) return false;
  // User is asking for the ability to edit (not asking AI to make an edit)
  return /\b(editable|changeable|let me (edit|change|rename|add|delete|remove)|i (want|need) to (edit|change|add|delete)|make.*editable|directly (edit|change))\b/i.test(
    userRequest,
  );
}

/** Returns a type-specific message redirecting the user to the built-in edit controls. */
export function getEditableRedirectMessage(creationType: CreationType): string {
  const messages: Partial<Record<CreationType, string>> = {
    habit_tracker:
      "Tap 'Edit habits' at the top to rename habits, change their icons, add new ones, or delete any you don't need.",
    budget_calculator:
      "Tap 'Edit budget' to change labels, amounts, categories, add rows, or delete anything you don't need.",
    price_calculator:
      "Tap 'Edit prices' to change items, quantities, unit prices, currency, or tax rate.",
    event_planner:
      "Tap 'Edit event' to change the event details and manage tasks.",
    meal_planner:
      "Tap 'Edit meals' to change meal names, add or remove meals, and update your grocery list.",
    workout_tracker:
      "Tap 'Edit challenge' to manage participants, update scoring rules, or change the weekly target. Use the quick log buttons to record activities.",
    task_planner:
      "Tap 'Edit tasks' to add, rename, or delete tasks and sections.",
    landing_page:
      "Tap 'Edit page' to change your business name, tagline, features, and contact details.",
    checklist:
      "Tap 'Edit list' to rename, add, or delete items and sections.",
    idea_thinking_board:
      "Tap 'Edit idea' to update any section — the title, summary, risks, money ideas, next steps, and scores are all editable.",
    recipe:
      "Tap 'Edit recipe' to change ingredients, steps, servings, and notes. Tick ingredients you already have to build your shopping list.",
    recipe_book:
      "Paste a cooking-video link in 'Add a recipe' to pull recipes in, and tap 'Preferences' to update your dietary, servings, and units anytime.",
  };
  return (
    messages[creationType] ??
    'You can edit this directly using the controls in the view.'
  );
}
