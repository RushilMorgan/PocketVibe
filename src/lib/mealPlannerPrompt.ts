/**
 * Builds the generation prompt for the standalone Meal Planner tool from a few
 * light inputs. Mirrors buildRecipePrompt / buildIdeaBoardPrompt — pure, no deps.
 */
export interface MealPlanIntakeInput {
  /** Free-text preferences, e.g. "2 adults, quick weeknight dinners, love Thai". */
  request: string;
  /** Dietary preference: 'none' | 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free'. */
  dietary?: string;
  /** How many people the plan should feed. */
  people?: number;
}

export function buildMealPlanPrompt(input: MealPlanIntakeInput): string {
  const lines: string[] = [];
  const who = input.people ? ` for ${input.people} ${input.people === 1 ? 'person' : 'people'}` : '';
  lines.push(`Make a practical, varied 7-day meal plan${who}.`);
  if (input.request.trim()) lines.push(`Preferences: ${input.request.trim()}.`);
  if (input.dietary && input.dietary !== 'none') {
    lines.push(`Keep every meal ${input.dietary}.`);
  }
  lines.push(
    'Cover dinner for all seven days, and add breakfasts, lunches or snacks where it helps. ' +
    'Keep meals realistic for a home cook and avoid repeating the same dish. Then produce a ' +
    'consolidated grocery list covering the whole week. Use a short "weekLabel" like "This week".',
  );
  return lines.join(' ');
}
