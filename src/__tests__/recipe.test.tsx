import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { RecipeContent } from '../types';
import { validateGenerateResponse, coerceGenerateResponse } from '../lib/validator';
import { getContentVisibleSignature } from '../lib/visibleSignature';
import { remixContent } from '../lib/remixContent';
import { buildRecipePrompt } from '../lib/recipePrompt';
import { RecipeRenderer } from '../components/templates/RecipeRenderer';
import { RecipeIntakeSheet } from '../components/RecipeIntakeSheet';

function makeRecipe(overrides: Partial<RecipeContent> = {}): RecipeContent {
  return {
    type: 'recipe',
    title: 'Test Pasta',
    servings: 2,
    prepTime: '10 min',
    cookTime: '15 min',
    ingredients: [
      { id: 'i1', name: 'Pasta', quantity: '200', unit: 'g', have: false },
      { id: 'i2', name: 'Tomato', quantity: '2', unit: '', have: false },
    ],
    steps: [
      { id: 's1', number: 1, text: 'Boil the pasta.' },
      { id: 's2', number: 2, text: 'Add the tomato.' },
    ],
    extraShoppingItems: [],
    notes: '',
    tags: ['quick'],
    layoutMode: 'card',
    ...overrides,
  };
}

describe('recipe validator', () => {
  it('accepts a valid recipe response', () => {
    const res = { title: 'Pasta', creationType: 'recipe', description: 'd', summary: 's', content: makeRecipe() };
    expect(validateGenerateResponse(res).valid).toBe(true);
  });

  it('rejects a recipe missing ingredients/steps arrays', () => {
    const bad = { title: 'X', creationType: 'recipe', description: 'd', summary: 's', content: { type: 'recipe', title: 'X' } };
    const r = validateGenerateResponse(bad);
    expect(r.valid).toBe(false);
  });

  it('coerces missing recipe fields to safe defaults', () => {
    const raw: Record<string, unknown> = { content: { type: 'recipe', title: 'X', ingredients: [{ id: 'i1', name: 'Egg' }], steps: [{ id: 's1', text: 'Fry' }] } };
    coerceGenerateResponse(raw);
    const c = raw.content as Record<string, unknown>;
    expect(Array.isArray(c.extraShoppingItems)).toBe(true);
    expect(c.layoutMode).toBe('card');
    expect((c.ingredients as Array<{ have: boolean }>)[0].have).toBe(false);
    expect((c.steps as Array<{ number: number }>)[0].number).toBe(1);
  });
});

describe('recipe visible signature', () => {
  it('ignores id-only and have/layout changes', () => {
    const a = makeRecipe();
    const b = makeRecipe({
      ingredients: a.ingredients.map(i => ({ ...i, have: true })),
      layoutMode: 'step',
    });
    expect(getContentVisibleSignature(a)).toBe(getContentVisibleSignature(b));
  });

  it('detects an ingredient or step text change', () => {
    const a = makeRecipe();
    const b = makeRecipe({ steps: [{ id: 's1', number: 1, text: 'Boil water first.' }, a.steps[1]] });
    expect(getContentVisibleSignature(a)).not.toBe(getContentVisibleSignature(b));
  });
});

describe('recipe remix', () => {
  it('resets personal fields and appends attribution', () => {
    const original = makeRecipe({
      ingredients: [{ id: 'i1', name: 'Pasta', have: true }],
      extraShoppingItems: [{ id: 'x1', name: 'Salt', checked: true }],
      notes: 'my note',
    });
    const remixed = remixContent(original, 'recipe', 'https://app/s/abc') as RecipeContent;
    expect(remixed.ingredients[0].have).toBe(false);
    expect(remixed.extraShoppingItems).toHaveLength(0);
    expect(remixed.notes).toBe('');
    expect(remixed.attribution?.[remixed.attribution.length - 1]).toEqual({ label: 'Adapted from', url: 'https://app/s/abc' });
  });
});

describe('buildRecipePrompt', () => {
  it('includes the URL, manual text, servings and dietary', () => {
    const p = buildRecipePrompt({ youtubeUrl: 'https://youtu.be/x', manualText: 'mix eggs', servings: 4, dietary: 'vegan' });
    expect(p).toContain('https://youtu.be/x');
    expect(p).toContain('mix eggs');
    expect(p).toContain('4 servings');
    expect(p).toContain('vegan');
  });
});

describe('RecipeRenderer', () => {
  it('ticking an ingredient moves it off the shopping list', () => {
    const onChange = vi.fn();
    render(<RecipeRenderer content={makeRecipe()} onChange={onChange} />);
    // The label shows in both the ingredient list and the shopping list; the
    // first occurrence is the ingredient checklist row.
    fireEvent.click(screen.getAllByText('200 g Pasta')[0]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: expect.arrayContaining([expect.objectContaining({ id: 'i1', have: true })]),
      }),
    );
  });

  it('switching layout to step persists layoutMode', () => {
    const onChange = vi.fn();
    render(<RecipeRenderer content={makeRecipe()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('recipe-layout-step'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ layoutMode: 'step' }));
  });

  it('editing notes fires onChange', () => {
    const onChange = vi.fn();
    render(<RecipeRenderer content={makeRecipe()} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('recipe-notes'), { target: { value: 'less salt' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: 'less salt' }));
  });
});

describe('RecipeIntakeSheet', () => {
  it('build is disabled until a URL or text is entered, then submits the payload', () => {
    const onSubmit = vi.fn();
    render(<RecipeIntakeSheet open onClose={noopFn} onSubmit={onSubmit} />);
    const build = screen.getByTestId('build-recipe-btn') as HTMLButtonElement;
    expect(build.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('recipe-url-input'), { target: { value: 'https://youtube.com/shorts/abc' } });
    expect(build.disabled).toBe(false);
    fireEvent.click(build);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ youtubeUrl: 'https://youtube.com/shorts/abc' }));
  });

  it('warns when the link does not look like a video URL', () => {
    render(<RecipeIntakeSheet open onClose={noopFn} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByTestId('recipe-url-input'), { target: { value: 'not a url' } });
    expect(screen.getByTestId('recipe-url-warning')).toBeInTheDocument();
  });
});

const noopFn = () => {};
