import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GenerateResponse } from '../types';
import * as aiServiceModule from '../services/aiService';

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

// ── Trust / visible-change verification ──────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

/** A habit tracker creation as it exists BEFORE any AI improvement. */
const HABIT_CREATION = {
  ...SAMPLE_CREATION,
  id: 'ht-1',
  title: 'Morning Habits',
  creationType: 'habit_tracker' as const,
  content: {
    type: 'habit_tracker' as const,
    habits: [
      { id: 'h1', name: 'Run', icon: '🏃', frequency: 'daily' as const, completions: {} },
    ],
    startDate: TODAY,
  },
};

const generateCreationMock = vi.mocked(aiServiceModule.generateCreation);

describe('trust — visible change verification', () => {
  beforeEach(() => {
    generateCreationMock.mockReset();
  });

  it('when AI returns identical content for improve, dispatches honest failure message and does NOT update version', async () => {
    const { result } = renderHook(() => usePocketVibe());

    // Seed the creation
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: HABIT_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'ht-1' });
    });

    // Mock AI returns IDENTICAL content (no visible change) — for BOTH initial + repair call
    const identicalResponse: GenerateResponse = {
      title: 'Morning Habits',
      creationType: 'habit_tracker',
      description: '',
      summary: 'I updated the tracker!', // AI claims success but content is same
      content: { ...HABIT_CREATION.content }, // same visible content
    };
    generateCreationMock.mockResolvedValue(identicalResponse);

    await act(async () => {
      result.current.improveCreation('improve the layout');
    });

    await waitFor(() => !result.current.state.isGenerating);

    // Must NOT claim "Done — I updated"
    const messages = result.current.state.messages;
    expect(messages.find(m => /done.*updated/i.test(m.text))).toBeUndefined();

    // Must dispatch honest failure message
    expect(messages.find(m => /didn't actually change/i.test(m.text))).toBeDefined();

    // Version must NOT have incremented
    const creation = result.current.state.creations.find(c => c.id === 'ht-1');
    expect(creation?.version).toBe(1);
  });

  it('when AI changes content for improve, increments version and shows "Done — I updated" message', async () => {
    const { result } = renderHook(() => usePocketVibe());

    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: HABIT_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'ht-1' });
    });

    // Mock AI returns CHANGED content (new habit added)
    const changedResponse: GenerateResponse = {
      title: 'Morning Habits',
      creationType: 'habit_tracker',
      description: '',
      summary: 'I added a new habit.',
      content: {
        type: 'habit_tracker',
        habits: [
          { id: 'h1', name: 'Run', icon: '🏃', frequency: 'daily', completions: {} },
          { id: 'h2', name: 'Meditate', icon: '🧘', frequency: 'daily', completions: {} },
        ],
        startDate: TODAY,
      },
    };
    generateCreationMock.mockResolvedValue(changedResponse);

    await act(async () => {
      result.current.improveCreation('add a meditation habit');
    });

    await waitFor(() => !result.current.state.isGenerating);

    // Must show "Done — I updated" message (not the AI summary)
    const messages = result.current.state.messages;
    expect(messages.find(m => /done.*updated/i.test(m.text))).toBeDefined();

    // Version must have incremented to 2
    const creation = result.current.state.creations.find(c => c.id === 'ht-1');
    expect(creation?.version).toBe(2);

    // Content must reflect the new habit
    const content = creation?.content as { type: 'habit_tracker'; habits: Array<{name:string}> };
    expect(content.habits.length).toBe(2);
  });

  it('same AI content but different summary → still shows no-change message, not the AI summary', async () => {
    const { result } = renderHook(() => usePocketVibe());

    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: HABIT_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'ht-1' });
    });

    // AI returns same content but a different (deceptive) summary
    const deceptiveResponse: GenerateResponse = {
      title: 'Morning Habits',
      creationType: 'habit_tracker',
      description: 'Updated description',
      summary: 'I completely redesigned your tracker!', // deceptive
      content: { ...HABIT_CREATION.content }, // same visible content
    };
    generateCreationMock.mockResolvedValue(deceptiveResponse);

    await act(async () => {
      result.current.improveCreation('make it look better');
    });

    await waitFor(() => !result.current.state.isGenerating);

    // Must NOT show the AI's deceptive summary
    const messages = result.current.state.messages;
    expect(messages.find(m => /completely redesigned/i.test(m.text))).toBeUndefined();

    // Must show honest failure
    expect(messages.find(m => /didn't actually change/i.test(m.text))).toBeDefined();
  });

  it('requesting "editable" for a habit_tracker redirects user to Edit habits button without calling AI', async () => {
    const { result } = renderHook(() => usePocketVibe());

    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: HABIT_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'ht-1' });
    });

    await act(async () => {
      result.current.improveCreation('make it editable so I can change things');
    });

    // AI must NOT be called
    expect(generateCreationMock).not.toHaveBeenCalled();

    // Must show helpful pointer to the built-in edit button
    const messages = result.current.state.messages;
    expect(messages.find(m => /edit habits/i.test(m.text))).toBeDefined();
  });

  it('requesting "editable" on a non-editable type (generative_html) returns honest "not yet" message', async () => {
    const htmlCreation = {
      ...SAMPLE_CREATION,
      id: 'gh-1',
      creationType: 'generative_html' as const,
      content: {
        type: 'generative_html' as const,
        html: '<p>Legacy</p>',
        tailwindMarkup: '<p>Legacy</p>',
      },
    };

    const { result } = renderHook(() => usePocketVibe());

    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: htmlCreation });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'gh-1' });
    });

    await act(async () => {
      result.current.improveCreation('make this editable');
    });

    // AI must NOT be called
    expect(generateCreationMock).not.toHaveBeenCalled();

    // Must show honest "not yet" message
    const messages = result.current.state.messages;
    expect(messages.find(m => /can't make that editable yet/i.test(m.text))).toBeDefined();
  });

  it('requesting "make this editable" on budget_calculator redirects to Edit budget without calling AI', async () => {
    const budgetCreation: Creation = {
      ...SAMPLE_CREATION,
      id: 'bc-1',
      title: 'Monthly Budget',
      creationType: 'budget_calculator',
      content: {
        type: 'budget_calculator',
        currency: 'R',
        income: [{ id: 'inc1', label: 'Salary', amount: 20000 }],
        expenses: [{ id: 'exp1', label: 'Rent', category: 'Housing', amount: 5000 }],
      },
    };

    const { result } = renderHook(() => usePocketVibe());

    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: budgetCreation });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'bc-1' });
    });

    await act(async () => {
      result.current.improveCreation('make this editable');
    });

    // AI must NOT be called
    expect(generateCreationMock).not.toHaveBeenCalled();

    // Must show the "Tap 'Edit budget'" message
    const messages = result.current.state.messages;
    expect(messages.find(m => /edit budget/i.test(m.text))).toBeDefined();
  });
});
