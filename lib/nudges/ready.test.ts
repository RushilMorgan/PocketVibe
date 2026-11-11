import { describe, expect, it } from 'vitest';
import { clip, readyMessage, trackedUrl } from './ready';

const base = {
  itemId: 'item-1',
  nudgeId: 'n-1',
  title: 'How vector databases actually work',
  firstLine: 'Vector databases find things by meaning, not keywords.',
  ingredientCount: null,
  thumbnailUrl: 'https://i.ytimg.com/vi_webp/abc/oar2.webp',
};

describe('clip', () => {
  it('keeps short text and trims long text with an ellipsis', () => {
    expect(clip('  hello   world ', 20)).toBe('hello world');
    expect(clip('a'.repeat(70), 60)).toHaveLength(60);
    expect(clip('a'.repeat(70), 60).endsWith('…')).toBe(true);
  });
});

describe('trackedUrl', () => {
  it('adds the nudge and action, keeping existing params', () => {
    expect(trackedUrl('/items/x', 'n1', 'open')).toBe('/items/x?n=n1&a=open');
    expect(trackedUrl('/items/x?play=1', 'n1', 'play')).toBe('/items/x?play=1&n=n1&a=play');
  });
});

describe('readyMessage', () => {
  it('offers Read and Play for an explainer, with the thumbnail', () => {
    const m = readyMessage({ ...base, kind: 'tech' });
    expect(m.title).toBe('How vector databases actually work');
    expect(m.body).toBe('Vector databases find things by meaning, not keywords.\n▶ 2-min lesson inside');
    expect(m.url).toBe('/items/item-1?n=n-1&a=open');
    expect(m.image).toBe(base.thumbnailUrl);
    expect(m.actions).toEqual([
      { action: 'read', title: 'Read', url: '/items/item-1?n=n-1&a=read' },
      { action: 'play', title: '▶ Play lesson', url: '/items/item-1?play=1&n=n-1&a=play' },
    ]);
  });

  it('offers the recipe card for a recipe', () => {
    const m = readyMessage({ ...base, kind: 'recipe', title: 'Chicken shawarma', ingredientCount: 14, thumbnailUrl: null });
    expect(m.body).toBe('14 ingredients — recipe card ready 🍳');
    expect(m.image).toBeUndefined();
    expect(m.actions).toEqual([{ action: 'read', title: 'Open recipe', url: '/items/item-1?n=n-1&a=read' }]);
  });

  it('adds the save it connects to', () => {
    expect(readyMessage({ ...base, kind: 'tech', relatedTitle: 'Cloning and Launching an AI SaaS Application' }).body).toBe(
      'Vector databases find things by meaning, not keywords.\n▶ 2-min lesson inside\n🔗 Connects to: Cloning and Launching an AI SaaS Application',
    );
    expect(readyMessage({ ...base, kind: 'recipe', ingredientCount: 6, relatedTitle: 'Chicken shawarma' }).body).toBe(
      '6 ingredients — recipe card ready 🍳\n🔗 Connects to: Chicken shawarma',
    );
  });

  it('falls back when the title and first line are missing', () => {
    const m = readyMessage({ ...base, kind: 'other', title: null, firstLine: null });
    expect(m.title).toBe('Your save is ready');
    expect(m.body).toBe('Your explainer and a 2-min lesson are ready');
  });
});
