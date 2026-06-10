import { describe, it, expect } from 'vitest';
import { pocketVibeReducer, INITIAL_STATE, type PVAction } from '../lib/pocketVibeReducer';
import type { Creation, PocketVibeState } from '../types';

function c(id: string, over: Partial<Creation> = {}): Creation {
  return {
    id, title: `T-${id}`, creationType: 'checklist', description: '', summary: '',
    originalRequest: '', status: 'ready', version: 1, createdAt: 0, updatedAt: 0,
    content: { type: 'checklist', sections: [] }, ...over,
  };
}
const base = (over: Partial<PocketVibeState> = {}): PocketVibeState => ({ ...INITIAL_STATE, ...over });

describe('pocketVibeReducer', () => {
  it('HYDRATE opens the active creation when it exists, else home', () => {
    const s1 = pocketVibeReducer(base(), { type: 'HYDRATE', payload: { creations: [c('a')], activeCreationId: 'a' } });
    expect(s1.view).toBe('creation');
    expect(s1.activeCreationId).toBe('a');
    const s2 = pocketVibeReducer(base(), { type: 'HYDRATE', payload: { creations: [c('a')], activeCreationId: 'gone' } });
    expect(s2.view).toBe('home');
    expect(s2.activeCreationId).toBeNull();
  });

  it('DELETE_CREATION clears active + routes to my-creations or home', () => {
    const start = base({ creations: [c('a'), c('b')], activeCreationId: 'a', view: 'creation' });
    const s = pocketVibeReducer(start, { type: 'DELETE_CREATION', payload: 'a' });
    expect(s.creations.map(x => x.id)).toEqual(['b']);
    expect(s.activeCreationId).toBeNull();
    expect(s.view).toBe('my-creations');
    const last = pocketVibeReducer(base({ creations: [c('a')], activeCreationId: 'a' }), { type: 'DELETE_CREATION', payload: 'a' });
    expect(last.view).toBe('home');
  });

  it('RENAME_CREATION trims + caps at 100 chars', () => {
    const long = 'x'.repeat(150);
    const s = pocketVibeReducer(base({ creations: [c('a')] }), { type: 'RENAME_CREATION', payload: { id: 'a', title: `  ${long}  ` } });
    expect(s.creations[0].title.length).toBe(100);
  });

  it('SET_CREATION_SHARE_SLUG + TOGGLE_FAVORITE update only the target', () => {
    const start = base({ creations: [c('a'), c('b')] });
    const s = pocketVibeReducer(start, { type: 'SET_CREATION_SHARE_SLUG', payload: { id: 'b', shareSlug: 'xyz' } });
    expect(s.creations.find(x => x.id === 'b')!.shareSlug).toBe('xyz');
    expect(s.creations.find(x => x.id === 'a')!.shareSlug).toBeUndefined();
    const fav = pocketVibeReducer(start, { type: 'TOGGLE_FAVORITE', payload: 'a' });
    expect(fav.creations.find(x => x.id === 'a')!.isFavorite).toBe(true);
  });

  it('ADD_MESSAGE appends, CLEAR_MESSAGES empties', () => {
    const m = { id: 'm1', role: 'user' as const, text: 'hi' };
    const s = pocketVibeReducer(base(), { type: 'ADD_MESSAGE', payload: m });
    expect(s.messages).toHaveLength(1);
    expect(pocketVibeReducer(s, { type: 'CLEAR_MESSAGES' } as PVAction).messages).toHaveLength(0);
  });

  it('is immutable — never mutates the input state', () => {
    const start = base({ creations: [c('a')] });
    const snapshot = JSON.stringify(start);
    pocketVibeReducer(start, { type: 'UPDATE_CREATION_CONTENT', payload: { id: 'a', content: { type: 'checklist', sections: [] } } });
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});
