/**
 * Tests for the usePocketVibe reducer — every PVAction is exercised.
 * Pure state-mutation logic is verified by dispatching actions via renderHook
 * and asserting the resulting state shape.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock aiService so processPrompt never hits the network in these tests
vi.mock('../services/aiService', () => ({
  generateBlocks: vi.fn(),
  GeminiConfigError: class GeminiConfigError extends Error {},
}));

import { usePocketVibe } from '../hooks/usePocketVibe';
import type { AIArchetype, VisualBlock } from '../types';

const LEX_ARCHETYPE: AIArchetype = {
  id: 'lex',
  name: 'Lex',
  tagline: 'Minimalist Architect',
  description: 'Clean layout generative AI.',
  emoji: '◻️',
  accentColor: '#1a1a1a',
};

const NOVA_ARCHETYPE: AIArchetype = {
  id: 'nova',
  name: 'Nova',
  tagline: 'App Strategist',
  description: 'Data-driven.',
  emoji: '🔭',
  accentColor: '#0ea5e9',
};

// Helper: advance to chat phase with a given archetype
function setupChatState(archetype: AIArchetype = LEX_ARCHETYPE) {
  const { result } = renderHook(() => usePocketVibe());
  act(() => { result.current.dispatch({ type: 'SELECT_ARCHETYPE', payload: archetype }); });
  act(() => { result.current.dispatch({ type: 'CONFIRM_COMPANION' }); });
  return result;
}

// ── Initial state ──────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('has a welcome hero block on canvas', () => {
    const { result } = renderHook(() => usePocketVibe());
    expect(result.current.state.appConfig.blocks).toHaveLength(1);
    expect(result.current.state.appConfig.blocks[0].type).toBe('hero_banner');
  });

  it('starts in onboarding phase with no archetype', () => {
    const { result } = renderHook(() => usePocketVibe());
    expect(result.current.state.companion.phase).toBe('onboarding');
    expect(result.current.state.companion.archetype).toBeNull();
  });

  it('starts with simulatePartner false and no shimmer', () => {
    const { result } = renderHook(() => usePocketVibe());
    expect(result.current.state.simulatePartner).toBe(false);
    expect(result.current.state.shimmeringBlockId).toBeNull();
  });
});

// ── Onboarding actions ─────────────────────────────────────────────────────────

describe('SELECT_ARCHETYPE', () => {
  it('sets companion archetype', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'SELECT_ARCHETYPE', payload: LEX_ARCHETYPE }); });
    expect(result.current.state.companion.archetype?.id).toBe('lex');
  });

  it('replaces a previously selected archetype', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'SELECT_ARCHETYPE', payload: LEX_ARCHETYPE }); });
    act(() => { result.current.dispatch({ type: 'SELECT_ARCHETYPE', payload: NOVA_ARCHETYPE }); });
    expect(result.current.state.companion.archetype?.id).toBe('nova');
  });
});

describe('SET_CUSTOM_NAME', () => {
  it('sets custom companion name', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'SET_CUSTOM_NAME', payload: 'Jarvis' }); });
    expect(result.current.state.companion.customName).toBe('Jarvis');
  });
});

describe('CONFIRM_COMPANION', () => {
  it('transitions phase to chat', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'SELECT_ARCHETYPE', payload: LEX_ARCHETYPE }); });
    act(() => { result.current.dispatch({ type: 'CONFIRM_COMPANION' }); });
    expect(result.current.state.companion.phase).toBe('chat');
  });

  it('prepends a greeting message from the companion', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'SELECT_ARCHETYPE', payload: LEX_ARCHETYPE }); });
    act(() => { result.current.dispatch({ type: 'CONFIRM_COMPANION' }); });
    const msgs = result.current.state.companion.messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('companion');
    expect(msgs[0].text).toContain('Lex');
  });

  it('uses customName in greeting when set', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'SELECT_ARCHETYPE', payload: LEX_ARCHETYPE }); });
    act(() => { result.current.dispatch({ type: 'SET_CUSTOM_NAME', payload: 'Atlas' }); });
    act(() => { result.current.dispatch({ type: 'CONFIRM_COMPANION' }); });
    expect(result.current.state.companion.messages[0].text).toContain('Atlas');
  });
});

// ── Global toggles & presets ───────────────────────────────────────────────────

describe('TOGGLE_SIMULATE_PARTNER', () => {
  it('toggles from false to true', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'TOGGLE_SIMULATE_PARTNER' }); });
    expect(result.current.state.simulatePartner).toBe(true);
  });

  it('toggles back to false on second dispatch', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'TOGGLE_SIMULATE_PARTNER' }); });
    act(() => { result.current.dispatch({ type: 'TOGGLE_SIMULATE_PARTNER' }); });
    expect(result.current.state.simulatePartner).toBe(false);
  });
});

describe('LOAD_PRESET', () => {
  it('grocery preset loads multiple blocks', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'LOAD_PRESET', payload: 'grocery' }); });
    expect(result.current.state.appConfig.blocks.length).toBeGreaterThan(1);
    expect(result.current.state.appConfig.blocks.some(b => b.type === 'interactive_list')).toBe(true);
  });

  it('blank preset resets to single welcome block', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'LOAD_PRESET', payload: 'grocery' }); });
    act(() => { result.current.dispatch({ type: 'LOAD_PRESET', payload: 'blank' }); });
    expect(result.current.state.appConfig.blocks).toHaveLength(1);
    expect(result.current.state.appConfig.blocks[0].type).toBe('hero_banner');
  });
});

describe('SET_STYLE_SLIDER', () => {
  it('updates slider value', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'SET_STYLE_SLIDER', payload: 75 }); });
    expect(result.current.state.appConfig.styleSlider).toBe(75);
  });
});

// ── Block interaction ──────────────────────────────────────────────────────────

describe('INTERACT_BLOCK', () => {
  it('cycles interactive_list item state from Pending → Done → Pending', () => {
    const { result } = renderHook(() => usePocketVibe());
    // Load a preset that has interactive_list
    act(() => { result.current.dispatch({ type: 'LOAD_PRESET', payload: 'grocery' }); });

    const listBlock = result.current.state.appConfig.blocks.find(
      b => b.type === 'interactive_list',
    ) as (typeof result.current.state.appConfig.blocks[0] & { type: 'interactive_list' }) | undefined;
    expect(listBlock).toBeDefined();
    if (!listBlock || listBlock.type !== 'interactive_list') return;

    const item = listBlock.items[0];

    act(() => {
      result.current.dispatch({ type: 'INTERACT_BLOCK', payload: { blockId: listBlock.id, itemId: item.id } });
    });

    const updatedBlock = result.current.state.appConfig.blocks.find(
      b => b.id === listBlock.id,
    );
    if (!updatedBlock || updatedBlock.type !== 'interactive_list') return;

    const updatedItem = updatedBlock.items.find(i => i.id === item.id)!;
    // Original state is 'Stocked' → next is 'Low'
    expect(updatedItem.state).not.toBe(item.state);
  });

  it('sets shimmeringBlockId to the interacted block', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'LOAD_PRESET', payload: 'grocery' }); });
    const listBlock = result.current.state.appConfig.blocks.find(b => b.type === 'interactive_list')!;
    act(() => {
      result.current.dispatch({ type: 'INTERACT_BLOCK', payload: { blockId: listBlock.id } });
    });
    expect(result.current.state.shimmeringBlockId).toBe(listBlock.id);
  });
});

// ── PROCESS_LLM_PROMPT — synchronous commands ─────────────────────────────────

describe('PROCESS_LLM_PROMPT — clear command', () => {
  it('resets canvas to welcome block on "clear"', () => {
    const result = setupChatState();
    act(() => { result.current.dispatch({ type: 'LOAD_PRESET', payload: 'grocery' }); });
    act(() => { result.current.dispatch({ type: 'PROCESS_LLM_PROMPT', payload: 'clear' }); });
    expect(result.current.state.appConfig.blocks).toHaveLength(1);
    expect(result.current.state.appConfig.blocks[0].type).toBe('hero_banner');
  });

  it('adds user message and companion reply for clear', () => {
    const result = setupChatState();
    const msgsBefore = result.current.state.companion.messages.length;
    act(() => { result.current.dispatch({ type: 'PROCESS_LLM_PROMPT', payload: 'clear' }); });
    expect(result.current.state.companion.messages.length).toBe(msgsBefore + 2);
    expect(result.current.state.companion.messages.at(-2)?.role).toBe('user');
    expect(result.current.state.companion.messages.at(-1)?.role).toBe('companion');
  });
});

describe('PROCESS_LLM_PROMPT — style token command', () => {
  it('neon theme changes accentColor to neon green', () => {
    const result = setupChatState();
    act(() => { result.current.dispatch({ type: 'PROCESS_LLM_PROMPT', payload: 'switch to neon theme' }); });
    expect(result.current.state.appConfig.accentColor).toBe('#00ff87');
  });

  it('minimal keyword increases styleSlider', () => {
    const result = setupChatState();
    const before = result.current.state.appConfig.styleSlider;
    act(() => { result.current.dispatch({ type: 'PROCESS_LLM_PROMPT', payload: 'make it more minimal' }); });
    expect(result.current.state.appConfig.styleSlider).toBeGreaterThan(before);
  });

  it('punchier keyword decreases styleSlider', () => {
    const result = setupChatState();
    act(() => { result.current.dispatch({ type: 'SET_STYLE_SLIDER', payload: 60 }); });
    act(() => { result.current.dispatch({ type: 'PROCESS_LLM_PROMPT', payload: 'make it punchier' }); });
    expect(result.current.state.appConfig.styleSlider).toBeLessThan(60);
  });

  it('dark theme changes accentColor to dark midnight value', () => {
    const result = setupChatState();
    act(() => { result.current.dispatch({ type: 'PROCESS_LLM_PROMPT', payload: 'dark theme please' }); });
    expect(result.current.state.appConfig.accentColor).toBe('#1e293b');
  });
});

describe('PROCESS_LLM_PROMPT — LLM path (non-sync commands)', () => {
  it('sets shimmeringBlockId to canvas-root while Gemini is pending', () => {
    const result = setupChatState();
    act(() => { result.current.dispatch({ type: 'PROCESS_LLM_PROMPT', payload: 'build a gym tracker' }); });
    expect(result.current.state.shimmeringBlockId).toBe('canvas-root');
  });

  it('adds user message immediately without waiting for Gemini', () => {
    const result = setupChatState();
    const before = result.current.state.companion.messages.length;
    act(() => { result.current.dispatch({ type: 'PROCESS_LLM_PROMPT', payload: 'build a grocery list' }); });
    expect(result.current.state.companion.messages.length).toBe(before + 1);
    expect(result.current.state.companion.messages.at(-1)?.role).toBe('user');
  });
});

// ── Async result actions ───────────────────────────────────────────────────────

describe('APPLY_GEMINI_BLOCKS', () => {
  const FAKE_BLOCKS: VisualBlock[] = [
    { type: 'action_button', id: 'g1', label: 'Test Action', icon: '🚀' },
  ];

  it('appends new blocks to canvas without removing existing ones', () => {
    const result = setupChatState();
    const before = result.current.state.appConfig.blocks.length;
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: FAKE_BLOCKS, replyText: 'Done!' },
      });
    });
    expect(result.current.state.appConfig.blocks.length).toBe(before + FAKE_BLOCKS.length);
    expect(result.current.state.appConfig.blocks.at(-1)?.id).toBe('g1');
  });

  it('appends companion reply message', () => {
    const result = setupChatState();
    const before = result.current.state.companion.messages.length;
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: FAKE_BLOCKS, replyText: 'Generated your layout.' },
      });
    });
    expect(result.current.state.companion.messages.length).toBe(before + 1);
    expect(result.current.state.companion.messages.at(-1)?.text).toBe('Generated your layout.');
  });

  it('sets shimmeringBlockId to first new block id', () => {
    const result = setupChatState();
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: FAKE_BLOCKS, replyText: '' },
      });
    });
    expect(result.current.state.shimmeringBlockId).toBe('g1');
  });
});

// ── GEMINI_ERROR — offline fallback engine ────────────────────────────────────

describe('GEMINI_ERROR fallback engine', () => {
  it('appends an interactive_list block for list-intent text', () => {
    const result = setupChatState();
    const before = result.current.state.appConfig.blocks.length;
    act(() => {
      result.current.dispatch({
        type: 'GEMINI_ERROR',
        payload: { text: 'build a packing list: passport, charger, clothes', errorMsg: 'Network timeout' },
      });
    });
    expect(result.current.state.appConfig.blocks.length).toBe(before + 1);
    const newBlock = result.current.state.appConfig.blocks.at(-1)!;
    expect(newBlock.type).toBe('interactive_list');
  });

  it('appends a metrics_row block for metrics-intent text', () => {
    const result = setupChatState();
    const before = result.current.state.appConfig.blocks.length;
    act(() => {
      result.current.dispatch({
        type: 'GEMINI_ERROR',
        payload: { text: 'show me a finance metrics dashboard', errorMsg: 'timeout' },
      });
    });
    expect(result.current.state.appConfig.blocks.length).toBe(before + 1);
    expect(result.current.state.appConfig.blocks.at(-1)!.type).toBe('metrics_row');
  });

  it('mentions the offline engine in the companion reply', () => {
    const result = setupChatState();
    const before = result.current.state.companion.messages.length;
    act(() => {
      result.current.dispatch({
        type: 'GEMINI_ERROR',
        payload: { text: 'build a list', errorMsg: 'timeout' },
      });
    });
    const reply = result.current.state.companion.messages.at(-1)?.text ?? '';
    expect(reply).toContain('offline engine');
  });

  it('flags missing API key with a specific config warning', () => {
    const result = setupChatState();
    act(() => {
      result.current.dispatch({
        type: 'GEMINI_ERROR',
        payload: {
          text: 'build a task list',
          errorMsg: 'VITE_GEMINI_API_KEY is not set in .env.local',
        },
      });
    });
    const reply = result.current.state.companion.messages.at(-1)?.text ?? '';
    expect(reply).toContain('AI key not configured');
  });
});

// ── SET_SHIMMER ────────────────────────────────────────────────────────────────

describe('SET_SHIMMER', () => {
  it('sets shimmeringBlockId to given value', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'SET_SHIMMER', payload: 'block-42' }); });
    expect(result.current.state.shimmeringBlockId).toBe('block-42');
  });

  it('clears shimmeringBlockId when null is passed', () => {
    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'SET_SHIMMER', payload: 'block-42' }); });
    act(() => { result.current.dispatch({ type: 'SET_SHIMMER', payload: null }); });
    expect(result.current.state.shimmeringBlockId).toBeNull();
  });
});
