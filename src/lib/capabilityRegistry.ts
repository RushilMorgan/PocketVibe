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
  | 'add_income'
  | 'add_expense'
  | 'delete_lines'
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
  budget_calculator: ['edit_amounts', 'edit_labels'],
  savings_tracker: ['add_contribution', 'edit_goal_name'],
  // These types show a generic JSON viewer — no direct user editing yet
  event_planner: [],
  meal_planner: [],
  workout_tracker: [],
  survey_form: [],
  task_planner: [],
  landing_page: [],
  generative_html: [],
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
  const fullyEditable: CreationType[] = ['habit_tracker'];
  if (!fullyEditable.includes(creationType)) return false;
  if (!supported.includes('edit_habit_names' as CreationCapability)) return false;
  // User is asking for the ability to edit (not asking AI to make an edit)
  return /\b(editable|changeable|let me (edit|change|rename)|make.*editable|directly edit)\b/i.test(
    userRequest,
  );
}
