import type { GenerateResponse, CreationType, ValidationResult } from '../types';

const SUPPORTED_TYPES = new Set<CreationType>([
  'checklist',
  'habit_tracker',
  'budget_calculator',
  'savings_tracker',
  'landing_page',
  'event_planner',
  'meal_planner',
  'workout_tracker',
  'survey_form',
  'task_planner',
  'generative_html',
]);

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function hasNoDangerousKeys(obj: Record<string, unknown>): boolean {
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(key)) return false;
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (!hasNoDangerousKeys(val as Record<string, unknown>)) return false;
    }
  }
  return true;
}

function validateContent(type: CreationType, content: Record<string, unknown>): string[] {
  const errors: string[] = [];
  switch (type) {
    case 'checklist':
      if (!Array.isArray(content.sections)) errors.push('Checklist requires a sections array');
      break;
    case 'habit_tracker':
      if (!Array.isArray(content.habits)) errors.push('Habit tracker requires a habits array');
      break;
    case 'budget_calculator':
      if (!Array.isArray(content.income)) errors.push('Budget calculator requires an income array');
      if (!Array.isArray(content.expenses)) errors.push('Budget calculator requires an expenses array');
      break;
    case 'savings_tracker':
      if (typeof content.targetAmount !== 'number') errors.push('Savings tracker requires numeric targetAmount');
      if (typeof content.goalName !== 'string') errors.push('Savings tracker requires a goalName string');
      break;
    case 'landing_page':
      if (typeof content.businessName !== 'string') errors.push('Landing page requires businessName');
      if (typeof content.tagline !== 'string') errors.push('Landing page requires a tagline');
      break;
    case 'event_planner':
      if (typeof content.eventName !== 'string') errors.push('Event planner requires eventName');
      if (!Array.isArray(content.tasks)) errors.push('Event planner requires a tasks array');
      break;
    case 'meal_planner':
      if (!Array.isArray(content.meals)) errors.push('Meal planner requires a meals array');
      break;
    case 'workout_tracker':
      if (typeof content.planName !== 'string') errors.push('Workout tracker requires planName');
      if (!Array.isArray(content.days)) errors.push('Workout tracker requires a days array');
      break;
    case 'survey_form':
      if (!Array.isArray(content.questions)) errors.push('Survey form requires a questions array');
      break;
    case 'task_planner':
      if (!Array.isArray(content.sections)) errors.push('Task planner requires a sections array');
      break;
    case 'generative_html':
      if (typeof content.tailwindMarkup !== 'string') {
        errors.push('generative_html requires a tailwindMarkup string');
      }
      break;
  }
  return errors;
}

export function validateGenerateResponse(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Response must be a JSON object'] };
  }

  const r = raw as Record<string, unknown>;

  if (!hasNoDangerousKeys(r)) {
    return { valid: false, errors: ['Response contains dangerous prototype keys'] };
  }

  if (typeof r.title !== 'string' || r.title.trim().length === 0) {
    errors.push('Missing or empty title');
  } else if (r.title.length > 100) {
    errors.push('Title too long (max 100 chars)');
  }

  if (typeof r.creationType !== 'string') {
    errors.push('Missing creationType');
  } else if (!SUPPORTED_TYPES.has(r.creationType as CreationType)) {
    errors.push(`Unsupported creationType: ${r.creationType}`);
  }

  if (typeof r.description !== 'string') {
    errors.push('Missing description');
  }

  if (typeof r.summary !== 'string' || r.summary.trim().length === 0) {
    errors.push('Missing or empty summary');
  }

  if (!r.content || typeof r.content !== 'object') {
    errors.push('Missing content object');
  } else {
    const content = r.content as Record<string, unknown>;
    if (content.type !== r.creationType) {
      errors.push(`content.type (${content.type}) does not match creationType (${r.creationType})`);
    } else if (typeof r.creationType === 'string' && SUPPORTED_TYPES.has(r.creationType as CreationType)) {
      errors.push(...validateContent(r.creationType as CreationType, content));
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Apply safe defaults to missing array fields so minor omissions don't fail validation. */
export function coerceGenerateResponse(raw: Record<string, unknown>): void {
  const content = raw.content as Record<string, unknown> | undefined;
  if (!content) return;
  const type = content.type as string;
  if (type === 'checklist' && !Array.isArray(content.sections)) content.sections = [];
  if (type === 'habit_tracker' && !Array.isArray(content.habits)) content.habits = [];
  if (type === 'budget_calculator') {
    if (!Array.isArray(content.income)) content.income = [];
    if (!Array.isArray(content.expenses)) content.expenses = [];
  }
  if (type === 'savings_tracker' && !Array.isArray(content.contributions)) content.contributions = [];
  if (type === 'event_planner' && !Array.isArray(content.tasks)) content.tasks = [];
  if (type === 'meal_planner' && !Array.isArray(content.meals)) content.meals = [];
  if (type === 'workout_tracker' && !Array.isArray(content.days)) content.days = [];
  if (type === 'survey_form' && !Array.isArray(content.questions)) content.questions = [];
  if (type === 'task_planner' && !Array.isArray(content.sections)) content.sections = [];
  if (type === 'landing_page' && !Array.isArray(content.features)) content.features = [];
}

export { SUPPORTED_TYPES };
export type { GenerateResponse };
