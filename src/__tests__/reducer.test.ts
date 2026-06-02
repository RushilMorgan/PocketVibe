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
  QuotaExceededError: class QuotaExceededError extends Error { name = 'QuotaExceededError'; },
  chatWithCreation: vi.fn(),
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
import * as creationStore from '../lib/creationStore';
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

describe('hydrate self-heal — stuck generating creations', () => {
  it('flips an orphaned generating creation to error on load (never stuck)', () => {
    const stuck: Creation = {
      ...SAMPLE_CREATION,
      id: 'c-stuck',
      title: 'Making something for you...',
      status: 'generating',
    };
    vi.mocked(creationStore.loadCreations).mockReturnValueOnce([stuck]);
    const { result } = renderHook(() => usePocketVibe());
    const healed = result.current.state.creations.find(c => c.id === 'c-stuck');
    expect(healed?.status).toBe('error');
  });

  it('leaves ready creations untouched on load', () => {
    vi.mocked(creationStore.loadCreations).mockReturnValueOnce([SAMPLE_CREATION]);
    const { result } = renderHook(() => usePocketVibe());
    const c = result.current.state.creations.find(x => x.id === 'c-1');
    expect(c?.status).toBe('ready');
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

  it('requesting "editable" on an unsupported legacy type returns honest "not yet" message', async () => {
    // Simulate old localStorage data with an unknown type (e.g. from a future migration)
    const legacyCreation = {
      ...SAMPLE_CREATION,
      id: 'gh-1',
      creationType: 'legacy_html',
      content: {
        type: 'legacy_html',
        html: '<p>Legacy</p>',
      },
    } as unknown as Creation;

    const { result } = renderHook(() => usePocketVibe());

    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: legacyCreation });
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

// ── Fix 2: AI config error does not overwrite existing creations ─────────────

describe('AIConfigError — improve/add never overwrites existing creation', () => {
  let generateCreationMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    generateCreationMock = vi.mocked(aiServiceModule.generateCreation);
    // Must throw an actual instance of the mocked AIConfigError for instanceof check
    generateCreationMock.mockRejectedValue(new aiServiceModule.AIConfigError('AI not configured'));
  });

  it('improve with AI unavailable keeps existing creation unchanged', async () => {
    const { result } = renderHook(() => usePocketVibe());

    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'c-1' });
    });

    const contentBefore = result.current.state.creations.find(c => c.id === 'c-1')?.content;
    const versionBefore = result.current.state.creations.find(c => c.id === 'c-1')?.version;

    await act(async () => {
      result.current.improveCreation('make this better');
    });

    const after = result.current.state.creations.find(c => c.id === 'c-1');
    expect(after?.content).toEqual(contentBefore);
    expect(after?.version).toBe(versionBefore);
    expect(after?.status).toBe('ready');
  });

  it('improve with AI unavailable shows honest message', async () => {
    const { result } = renderHook(() => usePocketVibe());

    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'c-1' });
    });

    await act(async () => {
      result.current.improveCreation('make this better');
    });

    const messages = result.current.state.messages;
    expect(messages.find(m => /AI is not connected/i.test(m.text))).toBeDefined();
  });

  it('new creation with AI unavailable still uses offline fallback', async () => {
    const { result } = renderHook(() => usePocketVibe());

    act(() => {
      result.current.startNewCreation('make me a checklist');
    });

    // Wait for the async generation to complete
    await waitFor(() => {
      expect(result.current.state.isGenerating).toBe(false);
    });

    expect(result.current.state.creations.length).toBeGreaterThan(0);
    const created = result.current.state.creations[0];
    expect(created.status).toBe('ready');
  });
});

// ── FIX 1: Invalid AI response on improve/add does not use offline fallback ──

describe('normalizeResponse null — improve/add does not use offline fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateCreationMock.mockReset();
  });

  it('when AI returns generative_html for improve, restores existing and shows honest message (NOT offline fallback)', async () => {
    const { result } = renderHook(() => usePocketVibe());

    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: SAMPLE_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'c-1' });
    });

    generateCreationMock.mockResolvedValue({
      title: 'HTML Page',
      creationType: 'generative_html' as never,
      description: '',
      summary: '',
      content: { type: 'generative_html', tailwindMarkup: '<div>Hello</div>' } as never,
    });

    await act(async () => {
      result.current.improveCreation('improve the layout');
    });

    await waitFor(() => expect(result.current.state.isGenerating).toBe(false));

    // Offline fallback must NOT be called for improve mode
    expect(vi.mocked(aiServiceModule.generateOfflineFallback)).not.toHaveBeenCalled();

    // Existing creation must be unchanged
    const creation = result.current.state.creations.find(c => c.id === 'c-1');
    expect(creation?.version).toBe(1);
    expect(creation?.content).toEqual(SAMPLE_CREATION.content);
    expect(creation?.status).toBe('ready');

    // Must show honest message
    expect(result.current.state.messages.find(m => /couldn't update that properly/i.test(m.text))).toBeDefined();
  });

  it('when AI returns generative_html for new, DOES use offline fallback', async () => {
    const { result } = renderHook(() => usePocketVibe());

    generateCreationMock.mockResolvedValue({
      title: 'HTML Page',
      creationType: 'generative_html' as never,
      description: '',
      summary: '',
      content: { type: 'generative_html', tailwindMarkup: '<div>Hello</div>' } as never,
    });

    act(() => {
      result.current.startNewCreation('make a checklist');
    });

    await waitFor(() => expect(result.current.state.isGenerating).toBe(false));

    // Offline fallback MUST be called for new mode
    expect(vi.mocked(aiServiceModule.generateOfflineFallback)).toHaveBeenCalled();
    expect(result.current.state.creations.length).toBeGreaterThan(0);
  });
});

// ── FIX 2/3: Local update handlers — tournament pool ─────────────────────────

const TOURNAMENT_CREATION: Creation = {
  id: 'tc-1',
  title: 'Family Pool',
  creationType: 'tournament_pool_tracker',
  description: '',
  summary: '',
  originalRequest: 'world cup pool',
  status: 'ready',
  version: 1,
  createdAt: 1000,
  updatedAt: 1000,
  content: {
    type: 'tournament_pool_tracker',
    poolName: 'Family Pool',
    tournamentName: 'World Cup',
    participants: [{ id: 'p1', name: 'Alice', emoji: '⭐' }],
    teams: [{ id: 't1', name: 'Brazil', pot: 1, status: 'active' }],
    matches: [],
    drawLocked: false,
    scoringRules: {
      pointsPerWin: 3, pointsPerDraw: 1, knockoutBonus: 5,
      quarterFinalBonus: 10, semiFinalBonus: 15, finalBonus: 20, winnerBonus: 50,
    },
  },
};

describe('local update handlers — tournament pool', () => {
  beforeEach(() => { vi.clearAllMocks(); generateCreationMock.mockReset(); });

  it('rename pool: updates poolName, increments version, does not call AI', async () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: TOURNAMENT_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'tc-1' });
    });
    await act(async () => { result.current.improveCreation('rename this to Morgan Family Pool'); });
    expect(generateCreationMock).not.toHaveBeenCalled();
    const creation = result.current.state.creations.find(c => c.id === 'tc-1')!;
    expect((creation.content as any).poolName).toBe('Morgan Family Pool');
    expect(creation.version).toBe(2);
  });

  it('add participant: adds participant, increments version, does not call AI', async () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: TOURNAMENT_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'tc-1' });
    });
    await act(async () => { result.current.improveCreation('add Sarah'); });
    expect(generateCreationMock).not.toHaveBeenCalled();
    const creation = result.current.state.creations.find(c => c.id === 'tc-1')!;
    expect((creation.content as any).participants).toHaveLength(2);
    expect((creation.content as any).participants[1].name).toBe('Sarah');
    expect(creation.version).toBe(2);
  });

  it('change points per win: updates scoringRules.pointsPerWin, does not call AI', async () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: TOURNAMENT_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'tc-1' });
    });
    await act(async () => { result.current.improveCreation('make points per win 5'); });
    expect(generateCreationMock).not.toHaveBeenCalled();
    const creation = result.current.state.creations.find(c => c.id === 'tc-1')!;
    expect((creation.content as any).scoringRules.pointsPerWin).toBe(5);
    expect(creation.version).toBe(2);
  });

  it('change winner bonus: updates scoringRules.winnerBonus, does not call AI', async () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: TOURNAMENT_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'tc-1' });
    });
    await act(async () => { result.current.improveCreation('make winner bonus 100'); });
    expect(generateCreationMock).not.toHaveBeenCalled();
    const creation = result.current.state.creations.find(c => c.id === 'tc-1')!;
    expect((creation.content as any).scoringRules.winnerBonus).toBe(100);
    expect(creation.version).toBe(2);
  });

  it('add team to pot: adds team with correct pot, does not call AI', async () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: TOURNAMENT_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'tc-1' });
    });
    await act(async () => { result.current.improveCreation('add Japan to pot 2'); });
    expect(generateCreationMock).not.toHaveBeenCalled();
    const creation = result.current.state.creations.find(c => c.id === 'tc-1')!;
    expect((creation.content as any).teams).toHaveLength(2);
    expect((creation.content as any).teams[1].name).toBe('Japan');
    expect((creation.content as any).teams[1].pot).toBe(2);
    expect(creation.version).toBe(2);
  });
});

// ── FIX 2/4: Local update handlers — workout challenge ───────────────────────

const WORKOUT_CHALLENGE_CREATION: Creation = {
  id: 'wc-1',
  title: 'Summer Challenge',
  creationType: 'workout_tracker',
  description: '',
  summary: '',
  originalRequest: 'walking challenge',
  status: 'ready',
  version: 1,
  createdAt: 1000,
  updatedAt: 1000,
  content: {
    type: 'workout_tracker',
    planName: 'Summer Challenge',
    challengeMode: true,
    participants: [{ id: 'p1', name: 'Alice', emoji: '🏃' }],
    weeklyTarget: 3,
    logs: [],
    scoringRules: { pointsPerActivity: 10, weeklyTargetBonus: 20, runningBonus: 5 },
  },
};

describe('local update handlers — workout challenge', () => {
  beforeEach(() => { vi.clearAllMocks(); generateCreationMock.mockReset(); });

  it('change points per activity: updates scoringRules.pointsPerActivity, does not call AI', async () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: WORKOUT_CHALLENGE_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'wc-1' });
    });
    await act(async () => { result.current.improveCreation('change points per activity to 15'); });
    expect(generateCreationMock).not.toHaveBeenCalled();
    const creation = result.current.state.creations.find(c => c.id === 'wc-1')!;
    expect((creation.content as any).scoringRules.pointsPerActivity).toBe(15);
    expect(creation.version).toBe(2);
  });

  it('change weekly target: updates weeklyTarget, does not call AI', async () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: WORKOUT_CHALLENGE_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'wc-1' });
    });
    await act(async () => { result.current.improveCreation('make weekly target 4'); });
    expect(generateCreationMock).not.toHaveBeenCalled();
    const creation = result.current.state.creations.find(c => c.id === 'wc-1')!;
    expect((creation.content as any).weeklyTarget).toBe(4);
    expect(creation.version).toBe(2);
  });

  it('add participant to workout challenge: does not call AI', async () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => {
      result.current.dispatch({ type: 'UPSERT_CREATION', payload: WORKOUT_CHALLENGE_CREATION });
      result.current.dispatch({ type: 'SET_ACTIVE_CREATION', payload: 'wc-1' });
    });
    await act(async () => { result.current.improveCreation('add Sarah'); });
    expect(generateCreationMock).not.toHaveBeenCalled();
    const creation = result.current.state.creations.find(c => c.id === 'wc-1')!;
    expect((creation.content as any).participants).toHaveLength(2);
    expect((creation.content as any).participants[1].name).toBe('Sarah');
    expect(creation.version).toBe(2);
  });
});
