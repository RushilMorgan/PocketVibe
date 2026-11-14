import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatMinutes,
  matchesQuery,
  parseSeconds,
  shownRecipes,
  stepIngredients,
  topTags,
  totalMinutes,
  type RecipeSummary,
} from './view';

function recipe(id: string, over: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id,
    title: `Recipe ${id}`,
    url: 'https://youtube.com/watch?v=x',
    source: 'youtube',
    thumbnail_url: null,
    created_at: '2026-11-01T10:00:00Z',
    description: '',
    servings: 4,
    totalMinutes: 40,
    ingredientCount: 5,
    stepCount: 4,
    tags: [],
    ingredients: [],
    wantToCookAt: null,
    cookedCount: 0,
    lastCookedAt: null,
    rating: null,
    ...over,
  };
}

describe('times', () => {
  it('reads the times the recipe prompt writes', () => {
    expect(parseSeconds('10 min')).toBe(600);
    expect(parseSeconds('1 hr 15 min')).toBe(4500);
    expect(parseSeconds('1.5 hours')).toBe(5400);
    expect(parseSeconds('45 sec')).toBe(45);
    expect(parseSeconds('10-12 minutes')).toBe(600);
    expect(parseSeconds('2 to 3 min')).toBe(120);
    expect(parseSeconds('5m')).toBe(300);
  });

  it('returns null when there is no time', () => {
    expect(parseSeconds('')).toBeNull();
    expect(parseSeconds(null)).toBeNull();
    expect(parseSeconds('overnight')).toBeNull();
    expect(parseSeconds('until golden')).toBeNull();
  });

  it('adds prep and cook', () => {
    expect(totalMinutes({ prepTime: '10 min', cookTime: '25 min' })).toBe(35);
    expect(totalMinutes({ prepTime: '', cookTime: '1 hr' })).toBe(60);
    expect(totalMinutes({ prepTime: '', cookTime: '' })).toBeNull();
  });

  it('formats minutes and countdowns', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(75)).toBe('1 h 15');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatClock(245)).toBe('4:05');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-3)).toBe('0:00');
    expect(formatClock(59.2)).toBe('1:00');
  });
});

describe('finding recipes', () => {
  const list = [
    recipe('shawarma', { title: 'Chicken shawarma', tags: ['middle eastern', 'dinner'], ingredients: ['chicken thighs', 'garlic', 'yoghurt'], totalMinutes: 50 }),
    recipe('dip', { title: 'Hot chicken dip', tags: ['snack', 'dinner'], ingredients: ['chicken breast', 'cream cheese'], totalMinutes: 20, created_at: '2026-11-05T10:00:00Z' }),
    recipe('bread', { title: 'No-knead bread', tags: ['baking'], ingredients: ['flour', 'yeast'], totalMinutes: null, cookedCount: 2, created_at: '2026-11-03T10:00:00Z' }),
  ];

  it('searches titles, tags and ingredients, needing every word', () => {
    expect(list.filter((r) => matchesQuery(r, 'chicken')).map((r) => r.id)).toEqual(['shawarma', 'dip']);
    expect(list.filter((r) => matchesQuery(r, 'chicken garlic')).map((r) => r.id)).toEqual(['shawarma']);
    expect(list.filter((r) => matchesQuery(r, 'YEAST')).map((r) => r.id)).toEqual(['bread']);
    expect(list.filter((r) => matchesQuery(r, '  ')).length).toBe(3);
  });

  it('filters by list, cooked, untried, quick and tag', () => {
    expect(shownRecipes(list, { filter: 'cooked' }).map((r) => r.id)).toEqual(['bread']);
    expect(shownRecipes(list, { filter: 'untried' }).map((r) => r.id)).toEqual(['dip', 'shawarma']);
    expect(shownRecipes(list, { filter: 'quick' }).map((r) => r.id)).toEqual(['dip']); // unknown time is not quick
    expect(shownRecipes(list, { tag: 'dinner', query: 'cream' }).map((r) => r.id)).toEqual(['dip']);
  });

  it('puts the Want to cook list first, latest added on top, then newest saved', () => {
    const marked = [
      { ...list[0], wantToCookAt: '2026-11-10T10:00:00Z' },
      list[1],
      { ...list[2], wantToCookAt: '2026-11-12T10:00:00Z' },
    ];
    expect(shownRecipes(marked, {}).map((r) => r.id)).toEqual(['bread', 'shawarma', 'dip']);
    expect(shownRecipes(marked, { filter: 'want' }).map((r) => r.id)).toEqual(['bread', 'shawarma']);
  });

  it('offers tags that at least two recipes share', () => {
    expect(topTags(list)).toEqual(['dinner']);
  });
});

describe('stepIngredients', () => {
  const names = ['Chicken thighs, boneless', 'Garlic cloves', 'Olive oil', 'Soy sauce', 'Salt', 'Fresh coriander (cilantro)', 'Tomatoes'];

  it('finds the ingredients a step mentions', () => {
    expect(stepIngredients('Rub the chicken with the garlic and a little salt.', names)).toEqual([0, 1, 4]);
    expect(stepIngredients('Chop the tomato and scatter over the coriander.', names)).toEqual([5, 6]);
    expect(stepIngredients('Drizzle with olive oil.', names)).toEqual([2]);
  });

  it("doesn't match on general words", () => {
    // "sauce" alone shouldn't pull in soy sauce; "fresh" shouldn't pull in coriander.
    expect(stepIngredients('Simmer the sauce until thick, then serve fresh.', names)).toEqual([]);
    expect(stepIngredients('Rest for 5 minutes.', names)).toEqual([]);
  });
});
