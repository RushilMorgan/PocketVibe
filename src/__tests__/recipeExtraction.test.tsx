import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { RecipeContent, RecipeBookContent, GenerationStageEvent } from '../types';
import { buildStageTimeline } from '../lib/stageTimeline';
import { recipeStageLabel } from '../lib/recipeStages';
import { getYouTubeVideoId, youtubeThumbnailUrl } from '../lib/youtubeThumb';
import { dishEmoji } from '../lib/recipeIcons';
import { CELEBRATE_EVENT, type CelebrationDetail } from '../lib/celebrate';
import { RecipeExtractionTheater } from '../components/templates/RecipeExtractionTheater';
import { RecipeBookRenderer } from '../components/templates/RecipeBookRenderer';

function makeRecipe(overrides: Partial<RecipeContent> = {}): RecipeContent {
  return {
    type: 'recipe',
    title: 'Test Pasta',
    servings: 2,
    ingredients: [{ id: 'i1', name: 'Pasta', quantity: '200', unit: 'g', have: false }],
    steps: [{ id: 's1', number: 1, text: 'Boil the pasta.' }],
    extraShoppingItems: [],
    notes: '',
    tags: [],
    layoutMode: 'card',
    ...overrides,
  };
}

function makeBook(overrides: Partial<RecipeBookContent> = {}): RecipeBookContent {
  return {
    type: 'recipe_book',
    title: 'My Cookbook',
    preferences: { dietary: 'none', servings: 2, units: 'metric' },
    recipes: [],
    ...overrides,
  };
}

describe('buildStageTimeline', () => {
  const label = (ev: GenerationStageEvent) => `label:${ev.stage}`;

  it('collapses a stage and its _done twin into one finished line', () => {
    const items = buildStageTimeline([{ stage: 'design' }, { stage: 'design_done' }], label);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: 'design', done: true });
  });

  it('marks every stage before the latest one as done', () => {
    const items = buildStageTimeline([{ stage: 'understand' }, { stage: 'design' }, { stage: 'build' }], label);
    expect(items.map(i => i.done)).toEqual([true, true, false]);
  });

  it('adopts the _done label only for stages in adoptDoneLabels', () => {
    const items = buildStageTimeline(
      [{ stage: 'understand' }, { stage: 'understand_done' }, { stage: 'build' }, { stage: 'build_done' }],
      label,
    );
    expect(items[0].label).toBe('label:understand_done');
    expect(items[1].label).toBe('label:build');
  });
});

describe('recipeStageLabel', () => {
  it('narrates the video path when a link was pasted', () => {
    expect(recipeStageLabel({ stage: 'understand' }, true)).toBe('Opening your video…');
    expect(recipeStageLabel({ stage: 'build' }, true)).toBe('Watching the video and writing it all down…');
  });

  it('narrates the pasted-text path otherwise', () => {
    expect(recipeStageLabel({ stage: 'understand' }, false)).toBe('Reading your recipe…');
    expect(recipeStageLabel({ stage: 'build' }, false)).toBe('Writing down the ingredients and steps…');
  });

  it('falls back to a generic cooking line for unknown stages', () => {
    expect(recipeStageLabel({ stage: 'mystery' }, true)).toBe('Cooking…');
  });
});

describe('RecipeExtractionTheater', () => {
  it('renders the stage timeline in kitchen voice', () => {
    render(<RecipeExtractionTheater stageEvents={[{ stage: 'understand' }, { stage: 'build' }]} hasVideo />);
    expect(screen.getByText('Toolie is in the kitchen')).toBeInTheDocument();
    expect(screen.getByText('Opening your video…')).toBeInTheDocument();
    expect(screen.getByText('Watching the video and writing it all down…')).toBeInTheDocument();
  });

  it('shows a fallback line before any stage events arrive', () => {
    render(<RecipeExtractionTheater stageEvents={[]} hasVideo />);
    expect(screen.getByText(/Pulling the recipe out of your video/)).toBeInTheDocument();
  });
});

describe('youtubeThumb', () => {
  it('extracts the video id from common link shapes', () => {
    expect(getYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(getYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(getYouTubeVideoId('https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ');
    expect(getYouTubeVideoId('https://youtube.com/shorts/abc123XYZ_-')).toBe('abc123XYZ_-');
    expect(getYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube links', () => {
    expect(getYouTubeVideoId('https://www.instagram.com/reel/xyz/')).toBeNull();
    expect(youtubeThumbnailUrl('not a url')).toBeNull();
  });

  it('builds the thumbnail url from a link', () => {
    expect(youtubeThumbnailUrl('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });
});

describe('dishEmoji', () => {
  it('prefers whole-dish names over ingredient words', () => {
    expect(dishEmoji('Chicken Burger')).toBe('🍔');
    expect(dishEmoji('Creamy Tomato Soup')).toBe('🍲');
  });
  it('falls back to ingredient matches, then the pot', () => {
    expect(dishEmoji('High-Protein Cottage Cheese Bake')).toBe('🧀');
    expect(dishEmoji('Mystery Dish')).toBe('🥘');
  });
});

describe('RecipeBookRenderer extraction loading + celebration', () => {
  it('shows the theater while extracting and narrates forwarded stage events', async () => {
    let resolveExtract!: (r: RecipeContent) => void;
    const onExtractRecipe = vi.fn(
      (_input: unknown, onStage?: (ev: GenerationStageEvent) => void) =>
        new Promise<RecipeContent>(resolve => {
          onStage?.({ stage: 'understand' });
          onStage?.({ stage: 'build' });
          resolveExtract = resolve;
        }),
    );
    render(<RecipeBookRenderer content={makeBook()} onChange={vi.fn()} onExtractRecipe={onExtractRecipe} />);
    fireEvent.change(screen.getByTestId('cookbook-url-input'), { target: { value: 'https://youtu.be/x' } });
    fireEvent.click(screen.getByTestId('cookbook-add-recipe-btn'));

    expect(await screen.findByTestId('recipe-extraction-theater')).toBeInTheDocument();
    expect(screen.getByText('Opening your video…')).toBeInTheDocument();
    expect(screen.getByText('Watching the video and writing it all down…')).toBeInTheDocument();
    // The add button gives way to the theater while work is running
    expect(screen.queryByTestId('cookbook-add-recipe-btn')).not.toBeInTheDocument();

    resolveExtract(makeRecipe());
    await waitFor(() => expect(screen.queryByTestId('recipe-extraction-theater')).not.toBeInTheDocument());
    expect(screen.getByTestId('cookbook-add-recipe-btn')).toBeInTheDocument();
  });

  it('attaches the source link and derived video thumbnail to the added recipe', async () => {
    const onChange = vi.fn();
    const onExtractRecipe = vi.fn().mockResolvedValue(makeRecipe());
    render(<RecipeBookRenderer content={makeBook()} onChange={onChange} onExtractRecipe={onExtractRecipe} />);
    fireEvent.change(screen.getByTestId('cookbook-url-input'), { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
    fireEvent.click(screen.getByTestId('cookbook-add-recipe-btn'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        recipes: [expect.objectContaining({
          sourceUrl: 'https://youtu.be/dQw4w9WgXcQ',
          thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        })],
      }),
    ));
  });

  it('shows the video thumbnail in the list row, dish emoji tile otherwise', () => {
    const book = makeBook({
      recipes: [
        makeRecipe({ title: 'Video Pasta', thumbnailUrl: 'https://img.youtube.com/vi/abc123xyz00/hqdefault.jpg' }),
        makeRecipe({ title: 'Manual Burger' }),
      ],
    });
    const { container } = render(<RecipeBookRenderer content={book} onChange={vi.fn()} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://img.youtube.com/vi/abc123xyz00/hqdefault.jpg');
    expect(screen.getByText('🍔')).toBeInTheDocument();
  });

  it('fires a big celebration for the first recipe in the cookbook', async () => {
    const heard: CelebrationDetail[] = [];
    const listener = (e: Event) => heard.push((e as CustomEvent<CelebrationDetail>).detail);
    window.addEventListener(CELEBRATE_EVENT, listener);
    try {
      const onExtractRecipe = vi.fn().mockResolvedValue(makeRecipe());
      render(<RecipeBookRenderer content={makeBook()} onChange={vi.fn()} onExtractRecipe={onExtractRecipe} />);
      fireEvent.change(screen.getByTestId('cookbook-url-input'), { target: { value: 'https://youtu.be/x' } });
      fireEvent.click(screen.getByTestId('cookbook-add-recipe-btn'));
      await waitFor(() => expect(heard).toHaveLength(1));
      expect(heard[0]).toMatchObject({ intensity: 'big', message: 'First recipe in your cookbook! 🍳' });
    } finally {
      window.removeEventListener(CELEBRATE_EVENT, listener);
    }
  });

  it('fires a small celebration for later recipes', async () => {
    const heard: CelebrationDetail[] = [];
    const listener = (e: Event) => heard.push((e as CustomEvent<CelebrationDetail>).detail);
    window.addEventListener(CELEBRATE_EVENT, listener);
    try {
      const onExtractRecipe = vi.fn().mockResolvedValue(makeRecipe({ title: 'Second Dish' }));
      const book = makeBook({ recipes: [makeRecipe()] });
      render(<RecipeBookRenderer content={book} onChange={vi.fn()} onExtractRecipe={onExtractRecipe} />);
      fireEvent.change(screen.getByTestId('cookbook-url-input'), { target: { value: 'https://youtu.be/y' } });
      fireEvent.click(screen.getByTestId('cookbook-add-recipe-btn'));
      await waitFor(() => expect(heard).toHaveLength(1));
      expect(heard[0].intensity).toBe('small');
      expect(heard[0].message).toBeUndefined();
    } finally {
      window.removeEventListener(CELEBRATE_EVENT, listener);
    }
  });

  it('does not celebrate when extraction fails', async () => {
    const heard: CelebrationDetail[] = [];
    const listener = (e: Event) => heard.push((e as CustomEvent<CelebrationDetail>).detail);
    window.addEventListener(CELEBRATE_EVENT, listener);
    try {
      const onExtractRecipe = vi.fn().mockResolvedValue(null);
      render(<RecipeBookRenderer content={makeBook()} onChange={vi.fn()} onExtractRecipe={onExtractRecipe} />);
      fireEvent.change(screen.getByTestId('cookbook-url-input'), { target: { value: 'https://youtu.be/x' } });
      fireEvent.click(screen.getByTestId('cookbook-add-recipe-btn'));
      await screen.findByText(/Couldn't read that one/);
      expect(heard).toHaveLength(0);
    } finally {
      window.removeEventListener(CELEBRATE_EVENT, listener);
    }
  });
});
