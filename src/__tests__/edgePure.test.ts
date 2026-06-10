import { describe, it, expect } from 'vitest';
import {
  getVisibleSignature,
  extractYouTubeUrl,
  parseJson,
} from '../../supabase/functions/pocketvibe-generate/pure';
import { getContentVisibleSignature } from '../lib/visibleSignature';
import type { CreationContent } from '../types';

describe('edge pure: extractYouTubeUrl', () => {
  it('matches shorts / watch / youtu.be links', () => {
    expect(extractYouTubeUrl('see https://youtube.com/shorts/abc123 now')).toBe('https://youtube.com/shorts/abc123');
    expect(extractYouTubeUrl('https://youtu.be/xY_9')).toBe('https://youtu.be/xY_9');
    expect(extractYouTubeUrl('watch https://www.youtube.com/watch?v=abc')).toContain('watch?v=abc');
  });
  it('returns null for non-YouTube text', () => {
    expect(extractYouTubeUrl('just some text')).toBeNull();
    expect(extractYouTubeUrl('https://tiktok.com/@x/video/1')).toBeNull();
  });
});

describe('edge pure: parseJson', () => {
  it('strips markdown fences', () => {
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJson('{"b":2}')).toEqual({ b: 2 });
  });
});

describe('edge/client visible-signature parity', () => {
  // The edge QA gate and the client both compute a "did anything visible change"
  // signature. They MUST agree per type, or improve/add reports the wrong result.
  const cases: CreationContent[] = [
    { type: 'checklist', sections: [{ id: 's1', title: 'A', items: [{ id: 'i1', label: 'x', checked: false }] }] },
    {
      type: 'recipe', title: 'Pasta', servings: 2, prepTime: '5', cookTime: '10',
      ingredients: [{ id: 'i1', name: 'Egg', quantity: '2', unit: '', have: false }],
      steps: [{ id: 's1', number: 1, text: 'Boil' }], extraShoppingItems: [], layoutMode: 'card',
    } as CreationContent,
  ];
  it.each(cases.map(c => [c.type, c] as const))('matches for %s', (_t, content) => {
    expect(getVisibleSignature(content as unknown as Record<string, unknown>)).toBe(getContentVisibleSignature(content));
  });

  it('signature ignores ids but reacts to visible text', () => {
    const a = { type: 'checklist', sections: [{ id: 's1', title: 'A', items: [{ id: 'i1', label: 'x', checked: false }] }] } as CreationContent;
    const idOnly = { type: 'checklist', sections: [{ id: 'DIFFERENT', title: 'A', items: [{ id: 'Z', label: 'x', checked: false }] }] } as CreationContent;
    const textChanged = { type: 'checklist', sections: [{ id: 's1', title: 'A', items: [{ id: 'i1', label: 'changed', checked: false }] }] } as CreationContent;
    expect(getVisibleSignature(a as unknown as Record<string, unknown>)).toBe(getVisibleSignature(idOnly as unknown as Record<string, unknown>));
    expect(getVisibleSignature(a as unknown as Record<string, unknown>)).not.toBe(getVisibleSignature(textChanged as unknown as Record<string, unknown>));
  });
});
