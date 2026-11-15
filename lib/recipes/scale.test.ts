import { describe, expect, it } from 'vitest';
import { formatNumber, ingredientGroups, parseHave, parseNumber, scaleQuantity, shoppingList, whatCanIMake } from './scale';
import type { RecipeSummary } from './view';

const ing = (name: string, quantity: string, unit = '', group?: string) => ({ name, quantity, unit, emoji: '🥄', ...(group === undefined ? {} : { group }) });

describe('quantities', () => {
  it('reads the numbers a recipe writes', () => {
    expect(parseNumber('2')).toBe(2);
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('1/2')).toBe(0.5);
    expect(parseNumber('1 1/2')).toBe(1.5);
    expect(parseNumber('½')).toBe(0.5);
    expect(parseNumber('1½')).toBe(1.5);
    expect(parseNumber('a pinch')).toBeNull();
    expect(parseNumber('1/0')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });

  it('writes numbers the way a cook would', () => {
    expect(formatNumber(0.5)).toBe('1/2');
    expect(formatNumber(1.5)).toBe('1 1/2');
    expect(formatNumber(2.3333)).toBe('2 1/3');
    expect(formatNumber(3)).toBe('3');
    expect(formatNumber(2.98)).toBe('3');
    expect(formatNumber(12.4)).toBe('12.5');
    expect(formatNumber(1200)).toBe('1200');
    expect(formatNumber(0.02)).toBe('a little');
  });

  it('scales numbers and ranges, and leaves words alone', () => {
    expect(scaleQuantity('1/2', 2)).toBe('1');
    expect(scaleQuantity('1', 0.5)).toBe('1/2');
    expect(scaleQuantity('800', 1.5)).toBe('1200');
    expect(scaleQuantity('2-3', 2)).toBe('4-6');
    expect(scaleQuantity('1 to 2', 0.5)).toBe('1/2-1');
    expect(scaleQuantity('a pinch', 3)).toBe('a pinch');
    expect(scaleQuantity('', 3)).toBe('');
  });

  it('never rewrites a quantity at the recipe’s own servings', () => {
    expect(scaleQuantity('1.50', 1)).toBe('1.50');
    expect(scaleQuantity('2 to 3', 1)).toBe('2 to 3');
  });
});

describe('ingredientGroups', () => {
  it('is one plain list when the recipe names fewer than two parts', () => {
    const groups = ingredientGroups({ ingredients: [ing('Flour', '2', 'cups'), ing('Salt', 'a pinch', '', 'Dough')] });
    expect(groups).toEqual([
      { name: null, lines: [{ index: 0, emoji: '🥄', name: 'Flour', amount: '2 cups' }, { index: 1, emoji: '🥄', name: 'Salt', amount: 'a pinch' }] },
    ]);
  });

  it('groups by part in first-seen order, keeping original positions, with loose ones last', () => {
    const groups = ingredientGroups(
      { ingredients: [ing('Chicken', '800', 'g', 'Chicken'), ing('Garlic', '2', '', 'Sauce'), ing('Cumin', '1', 'tsp', 'Chicken'), ing('Flatbreads', '4', ''), ing('Yoghurt', '1/2', 'cup', 'Sauce')] },
      2,
    );
    expect(groups.map((g) => [g.name, g.lines.map((l) => l.index)])).toEqual([
      ['Chicken', [0, 2]],
      ['Sauce', [1, 4]],
      ['Everything else', [3]],
    ]);
    expect(groups[1].lines[1].amount).toBe('1 cup');
  });
});

describe('shoppingList', () => {
  const recipe = { title: 'Shawarma', ingredients: [ing('Chicken', '800', 'g', 'Chicken'), ing('Garlic', '2', '', 'Sauce'), ing('Salt', '', '', 'Chicken')] };

  it('lists what is not ticked, scaled, under group headings', () => {
    expect(shoppingList(recipe, { factor: 0.5, servings: 2, have: [1] })).toBe('Shawarma (serves 2)\nChicken:\n- 400 g Chicken\n- Salt');
  });

  it('is a flat list for an ungrouped recipe', () => {
    expect(shoppingList({ title: 'Toast', ingredients: [ing('Bread', '2', 'slices')] })).toBe('Toast\n- 2 slices Bread');
  });
});

describe('what can I make', () => {
  const recipe = (id: string, ingredients: string[], created_at = '2026-11-01T10:00:00Z'): RecipeSummary => ({
    id,
    title: id,
    url: 'https://example.com',
    source: 'article',
    thumbnail_url: null,
    created_at,
    description: '',
    servings: 2,
    totalMinutes: null,
    ingredientCount: ingredients.length,
    stepCount: 3,
    tags: [],
    ingredients,
    wantToCookAt: null,
    cookedCount: 0,
    lastCookedAt: null,
    rating: null,
  });
  const list = [
    recipe('shawarma', ['chicken thighs', 'garlic cloves', 'yoghurt', 'cumin', 'flatbreads']),
    recipe('rice bowl', ['chicken breast', 'rice', 'garlic']),
    recipe('bread', ['flour', 'yeast', 'salt']),
  ];

  it('splits what you type into things', () => {
    expect(parseHave('Chicken, rice and garlic\neggs; Chicken')).toEqual(['chicken', 'rice', 'garlic', 'eggs']);
    expect(parseHave('  ')).toEqual([]);
  });

  it('ranks by how many of your things a recipe uses, then by how little else it needs', () => {
    const out = whatCanIMake(list, ['chicken', 'rice', 'garlic']);
    expect(out.map((m) => [m.recipe.id, m.matched, m.missing])).toEqual([
      ['rice bowl', ['chicken', 'rice', 'garlic'], 0],
      ['shawarma', ['chicken', 'garlic'], 3],
    ]);
  });

  it('matches singular and plural, and whole words only', () => {
    expect(whatCanIMake(list, ['flatbread']).map((m) => m.recipe.id)).toEqual(['shawarma']);
    expect(whatCanIMake(list, ['clove']).map((m) => m.recipe.id)).toEqual(['shawarma']);
    expect(whatCanIMake(list, ['ric'])).toEqual([]); // not "rice"
    expect(whatCanIMake(list, ['tofu'])).toEqual([]);
  });
});
