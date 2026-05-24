import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/aiService', () => ({
  generateCreation: vi.fn(),
  generateOfflineFallback: vi.fn(() => ({
    title: 'Test',
    creationType: 'checklist',
    description: '',
    summary: '',
    content: { type: 'checklist', sections: [] },
  })),
  AIConfigError: class AIConfigError extends Error { name = 'AIConfigError'; },
  GeminiConfigError: class GeminiConfigError extends Error { name = 'AIConfigError'; },
}));

vi.mock('../lib/creationStore', () => ({
  loadCreations: vi.fn(() => []),
  saveCreations: vi.fn(),
  loadActiveCreationId: vi.fn(() => null),
  saveActiveCreationId: vi.fn(),
  upsertCreation: vi.fn((list: unknown[], c: unknown) => {
    const arr = list as Array<{ id: string }>;
    const item = c as { id: string };
    const idx = arr.findIndex(x => x.id === item.id);
    if (idx >= 0) { const next = [...arr]; next[idx] = item; return next; }
    return [...arr, item];
  }),
  deleteCreationById: vi.fn((list: unknown[], id: unknown) =>
    (list as Array<{ id: string }>).filter(c => c.id !== id)
  ),
}));

import { usePocketVibe } from '../hooks/usePocketVibe';
import type { Creation } from '../types';

const SAMPLE_CREATION: Creation = {
  id: 'c-1',
  title: 'My Checklist',
  creationType: 'checklist',
  description: 'A test checklist',
  summary: 'Test summary',
  originalRequest: 'make a checklist',
  status: 'ready',
  version: 1,
  createdAt: 1000,
  updatedAt: 1000,
  content: { type: 'checklist', sections: [] },
};

describe('initial state', () => {
  it('starts on home view with no creations', () => {
    const { result } = renderHook(() => usePocketVibe());
    expect(result.current.state.view).toBe('home');
    expect(result.current.state.creations).toHaveLength(0);
    expect(result.current.state.activeCreationId).toBeNull();
  });

  it('starts with isGenerating false', () => {
    const { result } = renderHook(() => usePocketVibe());
    expect(result.current.state.isGenerating).toBe(false);
  });
});

describe('navigation', () => {
  it('goHome sets view to home', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'SET_VIEW', payload: 'my-creations' }); });
    act(() => { result.current.goHome(); });
    expect(result.current.state.view).toBe('home');
  });

  it('goToMyCreations sets view to my-creations', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.goToMyCreations(); });
    expect(result.current.state.view).toBe('my-creations');
  });

  it('openCreation sets active id and view to creation', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION }); });
    act(() => { result.current.openCreation('c-1'); });
    expect(result.current.state.activeCreationId).toBe('c-1');
    expect(result.current.state.view).toBe('creation');
  });
});

describe('creation management', () => {
  it('deleteCreation removes the creation', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION }); });
    act(() => { result.current.deleteCreation('c-1'); });
    expect(result.current.state.creations).toHaveLength(0);
  });

  it('deleteCreation clears activeCreationId when active is deleted', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION }); });
    act(() => { result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'c-1' }); });
    act(() => { result.current.deleteCreation('c-1'); });
    expect(result.current.state.activeCreationId).toBeNull();
  });

  it('renameCreation updates the title', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION }); });
    act(() => { result.current.renameCreation('c-1', 'New Title'); });
    const found = result.current.state.creations.find(c => c.id === 'c-1');
    expect(found?.title).toBe('New Title');
  });

  it('duplicateCreation adds a new creation with (copy) in title', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION }); });
    act(() => { result.current.duplicateCreation('c-1'); });
    expect(result.current.state.creations).toHaveLength(2);
    const copy = result.current.state.creations.find(c => c.id !== 'c-1')!;
    expect(copy.title).toContain('copy');
  });

  it('updateCreationContent updates content in place', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION }); });
    const newContent = {
      type: 'checklist' as const,
      sections: [{ id: 's1', title: 'New', items: [] }],
    };
    act(() => { result.current.updateCreationContent('c-1', newContent); });
    const found = result.current.state.creations.find(c => c.id === 'c-1');
    expect((found?.content as typeof newContent).sections).toHaveLength(1);
  });
});

describe('pending action guard', () => {
  it('sets pendingAction when starting new with active ready creation in creation view', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'c-1' });
      result.current.dispatch({ type: 'SET_VIEW', payload: 'creation' });
    });
    act(() => { result.current.startNewCreation('make another'); });
    expect(result.current.state.pendingAction).not.toBeNull();
    expect(result.current.state.pendingAction?.type).toBe('new-creation');
  });

  it('dismissPendingAction clears pendingAction', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'c-1' });
      result.current.dispatch({ type: 'SET_VIEW', payload: 'creation' });
    });
    act(() => { result.current.startNewCreation('make another'); });
    act(() => { result.current.dismissPendingAction(); });
    expect(result.current.state.pendingAction).toBeNull();
  });
});

describe('messages', () => {
  it('ADD_MESSAGE appends to messages array', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'ADD_MESSAGE', payload: { id: 'm1', role: 'user', text: 'hello' } });
    });
    expect(result.current.state.messages).toHaveLength(1);
    expect(result.current.state.messages[0].text).toBe('hello');
  });

  it('CLEAR_MESSAGES empties the messages array', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'ADD_MESSAGE', payload: { id: 'm1', role: 'user', text: 'hello' } });
      result.current.dispatch({ type: 'CLEAR_MESSAGES' });
    });
    expect(result.current.state.messages).toHaveLength(0);
  });
});
