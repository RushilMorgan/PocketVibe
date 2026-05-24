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
  // Landing page
  | 'edit_page_fields';

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
  checklist: ['toggle_items'],
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
  savings_tracker: ['add_contribution', 'edit_goal_name'],
  // These types show a generic JSON viewer — no direct user editing yet
  event_planner: [],
  meal_planner: [],
  workout_tracker: [],
  survey_form: [],
  task_planner: [],
  landing_page: [],
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
  const fullyEditable: CreationType[] = ['habit_tracker', 'budget_calculator'];
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
  };
  return (
    messages[creationType] ??
    'You can edit this directly using the controls in the view.'
  );
}
