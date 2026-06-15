import { describe, it, expect } from 'vitest';
import { routeShare } from '../lib/shareRouter';

describe('routeShare', () => {
  it('routes a YouTube link (in the url field) to the recipe extractor first', () => {
    const s = routeShare({ url: 'https://www.youtube.com/watch?v=abc123' });
    expect(s.url).toBe('https://www.youtube.com/watch?v=abc123');
    expect(s.targets[0].key).toBe('recipe-extractor');
  });

  it('routes a youtu.be short link to the recipe extractor', () => {
    const s = routeShare({ text: 'check this https://youtu.be/abc123 out' });
    expect(s.url).toBe('https://youtu.be/abc123');
    expect(s.targets[0].key).toBe('recipe-extractor');
  });

  it('finds a URL inside the shared text when no url field is present', () => {
    const s = routeShare({ text: 'great recipe https://www.allrecipes.com/recipe/123' });
    expect(s.url).toBe('https://www.allrecipes.com/recipe/123');
    expect(s.targets[0].key).toBe('recipe-extractor');
  });

  it('falls back to the default order for an unrecognised link', () => {
    const s = routeShare({ url: 'https://example.com/some-article' });
    // No rule matched → first catalog tool, not a forced recipe pick.
    expect(s.targets[0].key).toBe('recipe-extractor'); // first in DEFAULT_ORDER
    expect(s.targets.map(t => t.key)).toContain('idea-board');
  });

  it('always ends with the home / "Ask Toolie" fallback', () => {
    const s = routeShare({ url: 'https://youtu.be/abc' });
    expect(s.targets[s.targets.length - 1].key).toBe('home');
  });

  it('does not duplicate the top pick in the rest of the list', () => {
    const s = routeShare({ url: 'https://www.youtube.com/watch?v=x' });
    const keys = s.targets.map(t => t.key);
    const recipeCount = keys.filter(k => k === 'recipe-extractor').length;
    expect(recipeCount).toBe(1);
  });

  it('handles an empty payload without throwing', () => {
    const s = routeShare({});
    expect(s.url).toBeNull();
    expect(s.targets.length).toBeGreaterThan(0);
  });
});
