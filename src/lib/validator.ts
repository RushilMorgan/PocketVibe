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
  'price_calculator',
  'task_planner',
  'tournament_pool_tracker',
  'idea_thinking_board',
  'recipe',
  'recipe_book',
  // generative_html is intentionally excluded — AI must not return raw HTML
]);

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const HTML_MARKERS = ['<html', '<!doctype', '<script', '<div', '</', 'onclick=', 'oninput=', 'class='];

export function containsHtmlDeep(value: unknown): boolean {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return HTML_MARKERS.some(m => lower.includes(m));
  }
  if (Array.isArray(value)) return value.some(item => containsHtmlDeep(item));
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(v => containsHtmlDeep(v));
  }
  return false;
}

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
      // days is required in basic mode; challenge mode uses participants + logs instead
      if (!Array.isArray(content.days) && !Array.isArray(content.participants) && !Array.isArray(content.logs)) {
        errors.push('Workout tracker requires days array or challenge mode data');
      }
      break;
    case 'price_calculator':
      if (!Array.isArray(content.lineItems)) errors.push('Price calculator requires a lineItems array');
      if (typeof content.currency !== 'string') errors.push('Price calculator requires a currency string');
      break;
    case 'task_planner':
      if (!Array.isArray(content.sections)) errors.push('Task planner requires a sections array');
      break;
    case 'tournament_pool_tracker':
      if (typeof content.poolName !== 'string') errors.push('Tournament pool requires poolName');
      if (!Array.isArray(content.participants)) errors.push('Tournament pool requires participants array');
      if (!Array.isArray(content.teams)) errors.push('Tournament pool requires teams array');
      if (!Array.isArray(content.matches)) errors.push('Tournament pool requires matches array');
      break;
    case 'idea_thinking_board':
      // Lenient: coercion fills missing arrays/objects, so only require the essentials.
      if (typeof content.ideaSummary !== 'string') errors.push('Idea board requires an ideaSummary string');
      if (!content.scores || typeof content.scores !== 'object') errors.push('Idea board requires a scores object');
      if (!content.visualMap || typeof content.visualMap !== 'object') errors.push('Idea board requires a visualMap object');
      break;
    case 'recipe':
      // Lenient: coercion fills missing arrays/fields, so only require the essentials.
      if (typeof content.title !== 'string') errors.push('Recipe requires a title string');
      if (!Array.isArray(content.ingredients)) errors.push('Recipe requires an ingredients array');
      if (!Array.isArray(content.steps)) errors.push('Recipe requires a steps array');
      break;
    case 'recipe_book':
      if (!Array.isArray(content.recipes)) errors.push('Cookbook requires a recipes array');
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
  } else if (containsHtmlDeep(r.title)) {
    errors.push('Title contains raw HTML');
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
  } else if (containsHtmlDeep(r.summary)) {
    errors.push('Summary contains raw HTML');
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
    if (containsHtmlDeep(content)) {
      errors.push('Content contains raw HTML');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Normalize a content object in-place, filling in all required sub-fields with
 * safe defaults so partially-generated AI output never causes NaN or runtime errors.
 * Called after every AI response — both from the edge function and the dev fallback.
 */
export function normalizeContentFields(content: Record<string, unknown>): void {
  const type = content.type as string;

  if (type === 'workout_tracker') {
    // Ensure challenge-mode arrays always exist
    if (content.challengeMode || Array.isArray(content.participants)) {
      if (!Array.isArray(content.participants)) content.participants = [];
      if (!Array.isArray(content.logs)) content.logs = [];
      if (!Array.isArray(content.activityTypes)) content.activityTypes = ['walk', 'run', 'gym', 'other'];
      if (typeof content.weeklyTarget !== 'number') content.weeklyTarget = 3;
      // Normalize scoringRules — spread defaults so missing numeric fields never produce NaN
      const sr = (content.scoringRules ?? {}) as Record<string, unknown>;
      content.scoringRules = {
        pointsPerActivity: typeof sr.pointsPerActivity === 'number' ? sr.pointsPerActivity : 10,
        weeklyTargetBonus: typeof sr.weeklyTargetBonus === 'number' ? sr.weeklyTargetBonus : 20,
        runningBonus:      typeof sr.runningBonus      === 'number' ? sr.runningBonus      : 5,
      };
    }
  }

  if (type === 'idea_thinking_board') {
    const clamp = (v: unknown, d: number) =>
      typeof v === 'number' && !Number.isNaN(v) ? Math.max(1, Math.min(10, Math.round(v))) : d;
    const sc = (content.scores ?? {}) as Record<string, unknown>;
    content.scores = {
      clarity:        clamp(sc.clarity, 5),
      usefulness:     clamp(sc.usefulness, 5),
      easeToBuild:    clamp(sc.easeToBuild, 5),
      moneyPotential: clamp(sc.moneyPotential, 5),
      riskLevel:      clamp(sc.riskLevel, 5),
      confidence:     clamp(sc.confidence, 5),
    };
    const vm = (content.visualMap ?? {}) as Record<string, unknown>;
    content.visualMap = {
      center: typeof vm.center === 'string' && vm.center ? vm.center : (typeof content.title === 'string' ? content.title : 'Your idea'),
      branches: Array.isArray(vm.branches) ? vm.branches : [],
    };
  }

  if (type === 'tournament_pool_tracker') {
    if (!Array.isArray(content.participants)) content.participants = [];
    if (!Array.isArray(content.teams))        content.teams = [];
    if (!Array.isArray(content.matches))      content.matches = [];
    if (typeof content.drawLocked !== 'boolean') content.drawLocked = false;
    // Normalize scoringRules
    const sr = (content.scoringRules ?? {}) as Record<string, unknown>;
    content.scoringRules = {
      pointsPerWin:      typeof sr.pointsPerWin      === 'number' ? sr.pointsPerWin      : 3,
      pointsPerDraw:     typeof sr.pointsPerDraw     === 'number' ? sr.pointsPerDraw     : 1,
      knockoutBonus:     typeof sr.knockoutBonus     === 'number' ? sr.knockoutBonus     : 5,
      quarterFinalBonus: typeof sr.quarterFinalBonus === 'number' ? sr.quarterFinalBonus : 10,
      semiFinalBonus:    typeof sr.semiFinalBonus    === 'number' ? sr.semiFinalBonus    : 15,
      finalBonus:        typeof sr.finalBonus        === 'number' ? sr.finalBonus        : 20,
      winnerBonus:       typeof sr.winnerBonus       === 'number' ? sr.winnerBonus       : 30,
    };
  }
}

/** Apply safe defaults to missing array/object fields so minor AI omissions don't fail validation. */
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
  // In challenge mode, days is optional — only default to [] in basic mode
  if (type === 'workout_tracker' && !Array.isArray(content.days) && !content.challengeMode && !Array.isArray(content.participants)) content.days = [];
  if (type === 'task_planner' && !Array.isArray(content.sections)) content.sections = [];
  if (type === 'landing_page' && !Array.isArray(content.features)) content.features = [];
  if (type === 'idea_thinking_board') {
    if (!Array.isArray(content.targetUsers))   content.targetUsers = [];
    if (!Array.isArray(content.risks))         content.risks = [];
    if (!Array.isArray(content.opportunities)) content.opportunities = [];
    if (!Array.isArray(content.moneyIdeas))    content.moneyIdeas = [];
    if (!Array.isArray(content.nextSteps))     content.nextSteps = [];
    if (typeof content.ideaSummary !== 'string') content.ideaSummary = '';
    if (typeof content.problem !== 'string')     content.problem = '';
    if (typeof content.solution !== 'string')    content.solution = '';
    if (typeof content.notes !== 'string')       content.notes = '';
  }
  if (type === 'recipe') {
    if (!Array.isArray(content.ingredients)) content.ingredients = [];
    if (!Array.isArray(content.steps))       content.steps = [];
    if (!Array.isArray(content.extraShoppingItems)) content.extraShoppingItems = [];
    if (typeof content.layoutMode !== 'string') content.layoutMode = 'card';
    if (typeof content.notes !== 'string')   content.notes = '';
    (content.ingredients as Array<Record<string, unknown>>).forEach(i => {
      if (typeof i.have !== 'boolean') i.have = false;
    });
    (content.steps as Array<Record<string, unknown>>).forEach((s, idx) => {
      if (typeof s.number !== 'number') s.number = idx + 1;
    });
  }
  if (type === 'recipe_book') {
    if (!Array.isArray(content.recipes)) content.recipes = [];
    if (!content.preferences || typeof content.preferences !== 'object') {
      content.preferences = { dietary: 'none', units: 'metric' };
    }
  }

  // Always normalize sub-object fields (scoringRules etc.) regardless of type
  normalizeContentFields(content);
}

export { SUPPORTED_TYPES };
export type { GenerateResponse };
