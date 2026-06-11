import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { RecipeContent, RecipeBookContent } from '../types';
import { validateGenerateResponse, coerceGenerateResponse } from '../lib/validator';
import { getContentVisibleSignature } from '../lib/visibleSignature';
import { remixContent } from '../lib/remixContent';
import { buildRecipePrompt } from '../lib/recipePrompt';
import { RecipeRenderer } from '../components/templates/RecipeRenderer';
import { RecipeBookRenderer } from '../components/templates/RecipeBookRenderer';
import { RecipeIntakeSheet } from '../components/RecipeIntakeSheet';
import { ingredientEmoji, stepEmoji } from '../lib/recipeIcons';

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

function makeBook(overrides: Partial<RecipeBookContent> = {}): RecipeBookContent {
  return {
    type: 'recipe_book',
    title: 'My Cookbook',
    preferences: { dietary: 'vegetarian', servings: 2, units: 'metric' },
    recipes: [],
    ...overrides,
  };
}

describe('recipe_book validator', () => {
  it('accepts a cookbook and coerces missing fields', () => {
    const res = { title: 'Cookbook', creationType: 'recipe_book', description: 'd', summary: 's', content: makeBook() };
    expect(validateGenerateResponse(res).valid).toBe(true);
    const raw: Record<string, unknown> = { content: { type: 'recipe_book', title: 'X' } };
    coerceGenerateResponse(raw);
    const c = raw.content as Record<string, unknown>;
    expect(Array.isArray(c.recipes)).toBe(true);
    expect(c.preferences).toBeTruthy();
  });
});

describe('recipe_book remix', () => {
  it('keeps recipes but resets each one\'s personal ticks/notes', () => {
    const book = makeBook({
      recipes: [makeRecipe({ ingredients: [{ id: 'i1', name: 'Egg', have: true }], notes: 'mine', extraShoppingItems: [{ id: 'x', name: 'Salt', checked: true }] })],
    });
    const remixed = remixContent(book, 'recipe_book') as RecipeBookContent;
    expect(remixed.recipes).toHaveLength(1);
    expect(remixed.recipes[0].ingredients[0].have).toBe(false);
    expect(remixed.recipes[0].notes).toBe('');
    expect(remixed.recipes[0].extraShoppingItems).toHaveLength(0);
  });
});

describe('RecipeBookRenderer', () => {
  it('extracts a recipe from a link and appends it to the cookbook', async () => {
    const onChange = vi.fn();
    const onExtractRecipe = vi.fn().mockResolvedValue(makeRecipe({ title: 'Pulled Recipe' }));
    render(<RecipeBookRenderer content={makeBook()} onChange={onChange} onExtractRecipe={onExtractRecipe} />);
    fireEvent.change(screen.getByTestId('cookbook-url-input'), { target: { value: 'https://youtu.be/x' } });
    fireEvent.click(screen.getByTestId('cookbook-add-recipe-btn'));
    await waitFor(() => expect(onExtractRecipe).toHaveBeenCalled());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ recipes: expect.arrayContaining([expect.objectContaining({ title: 'Pulled Recipe' })]) }),
    ));
    // extraction was called with the cookbook's dietary preference (+ live stage callback)
    expect(onExtractRecipe).toHaveBeenCalledWith(expect.objectContaining({ dietary: 'vegetarian' }), expect.any(Function));
  });

  it('hides the add-recipe box for viewers (no onExtractRecipe)', () => {
    render(<RecipeBookRenderer content={makeBook()} onChange={vi.fn()} />);
    expect(screen.queryByTestId('cookbook-add-recipe-btn')).not.toBeInTheDocument();
  });

  it('explains the units preference in plain language', () => {
    const { rerender } = render(<RecipeBookRenderer content={makeBook()} onChange={vi.fn()} />);
    expect(screen.getByText(/Metric — g & ml/)).toBeInTheDocument();
    rerender(<RecipeBookRenderer content={makeBook({ preferences: { dietary: 'none', units: 'imperial' } })} onChange={vi.fn()} />);
    expect(screen.getByText(/Imperial — cups & oz/)).toBeInTheDocument();
  });

  it('updates preferences', () => {
    const onChange = vi.fn();
    render(<RecipeBookRenderer content={makeBook()} onChange={onChange} onExtractRecipe={vi.fn()} />);
    fireEvent.click(screen.getByTestId('cookbook-prefs-toggle'));
    fireEvent.click(screen.getByText('vegan'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preferences: expect.objectContaining({ dietary: 'vegan' }) }));
  });
});

describe('RecipeIntakeSheet (cookbook setup)', () => {
  it('builds a cookbook with the chosen preferences', () => {
    const onSubmit = vi.fn();
    render(<RecipeIntakeSheet open onClose={noopFn} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('cookbook-name-input'), { target: { value: 'Weeknight Dinners' } });
    fireEvent.click(screen.getByTestId('cookbook-dietary-vegan'));
    fireEvent.click(screen.getByTestId('cookbook-units-imperial'));
    fireEvent.click(screen.getByTestId('build-cookbook-btn'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Weeknight Dinners', dietary: 'vegan', units: 'imperial' }));
  });
});

describe('recipeIcons', () => {
  it('matches sensible fallback emoji and defaults', () => {
    expect(ingredientEmoji('Chicken breast')).toBe('🍗');
    expect(ingredientEmoji('2 eggs')).toBe('🥚');
    expect(ingredientEmoji('quux widget')).toBe('🥘');
    expect(stepEmoji('Chop the onion finely')).toBe('🔪');
    expect(stepEmoji('Bake for 20 minutes')).toBe('🔥');
    expect(stepEmoji('ponder existence')).toBe('👩‍🍳');
  });
});

describe('RecipeRenderer tap-to-talk', () => {
  it('shows Ask Toolie only when onChat is provided', () => {
    const { rerender } = render(<RecipeRenderer content={makeRecipe()} onChange={vi.fn()} />);
    expect(screen.queryByTestId('recipe-ask-toolie')).not.toBeInTheDocument();
    rerender(<RecipeRenderer content={makeRecipe()} onChange={vi.fn()} onChat={vi.fn()} />);
    expect(screen.getByTestId('recipe-ask-toolie')).toBeInTheDocument();
  });

  it('sends a message and applies an updated recipe from the AI', async () => {
    const onChange = vi.fn();
    const updated = makeRecipe({ title: 'Dairy-free Pasta' });
    const onChat = vi.fn().mockResolvedValue({ answer: 'Swapped the butter for olive oil.', updatedRecipe: updated });
    render(<RecipeRenderer content={makeRecipe()} onChange={onChange} onChat={onChat} />);
    fireEvent.click(screen.getByTestId('recipe-ask-toolie'));
    fireEvent.change(screen.getByTestId('recipe-chat-input'), { target: { value: 'make it dairy free' } });
    fireEvent.submit(screen.getByTestId('recipe-chat-input').closest('form')!);
    await waitFor(() => expect(onChat).toHaveBeenCalledWith('make it dairy free'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(updated));
    expect(await screen.findByText('Swapped the butter for olive oil.')).toBeInTheDocument();
  });
});

const noopFn = () => {};
