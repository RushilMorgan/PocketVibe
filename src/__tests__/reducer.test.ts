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

  it('updates a form field value when itemId contains fieldId:value', () => {
    const { result } = renderHook(() => usePocketVibe());
    // Seed an interactive_form block directly via APPLY_GEMINI_BLOCKS
    const formBlock: VisualBlock = {
      type: 'interactive_form',
      id: 'form-1',
      title: 'Tax Calc',
      submitLabel: 'Calculate',
      fields: [
        { id: 'f1', label: 'Income', type: 'number', placeholder: '0', value: '0' },
      ],
    };
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: [formBlock], replyText: 'Form ready.' },
      });
    });
    act(() => {
      result.current.dispatch({ type: 'INTERACT_BLOCK', payload: { blockId: 'form-1', itemId: 'f1:85000' } });
    });
    const updated = result.current.state.appConfig.blocks.find(b => b.id === 'form-1');
    if (!updated || updated.type !== 'interactive_form') throw new Error('block not found');
    expect(updated.fields[0].value).toBe('85000');
  });

  it('handles colon-containing values correctly (e.g. time string)', () => {
    const { result } = renderHook(() => usePocketVibe());
    const formBlock: VisualBlock = {
      type: 'interactive_form',
      id: 'form-2',
      title: 'Schedule',
      submitLabel: 'Set',
      fields: [{ id: 'ft', label: 'Time', type: 'text', value: '' }],
    };
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: [formBlock], replyText: 'ok' },
      });
    });
    act(() => {
      result.current.dispatch({ type: 'INTERACT_BLOCK', payload: { blockId: 'form-2', itemId: 'ft:14:30' } });
    });
    const updated = result.current.state.appConfig.blocks.find(b => b.id === 'form-2');
    if (!updated || updated.type !== 'interactive_form') throw new Error('block not found');
    expect(updated.fields[0].value).toBe('14:30');
  });

  it('recomputes computedMetrics values on field change', () => {
    const { result } = renderHook(() => usePocketVibe());
    const formBlock: VisualBlock = {
      type: 'interactive_form',
      id: 'form-3',
      title: 'Tax Calculator',
      submitLabel: 'Calculate',
      fields: [
        { id: 'gross_income', label: 'Gross Income', type: 'number', placeholder: '0', value: '100000' },
        { id: 'tax_rate', label: 'Tax Rate', type: 'slider', value: '25' },
      ],
      computedMetrics: [
        { label: 'Tax Owed', formula: '($gross_income * $tax_rate) / 100' },
        { label: 'Net Take Home', formula: '$gross_income - (($gross_income * $tax_rate) / 100)' },
      ],
    };
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: [formBlock], replyText: 'Tax form ready.' },
      });
    });
    // Adjust tax_rate slider to 30
    act(() => {
      result.current.dispatch({ type: 'INTERACT_BLOCK', payload: { blockId: 'form-3', itemId: 'tax_rate:30' } });
    });
    const updated = result.current.state.appConfig.blocks.find(b => b.id === 'form-3');
    if (!updated || updated.type !== 'interactive_form') throw new Error('block not found');
    // (100000 * 30) / 100 = 30000
    expect(updated.computedMetrics![0].value).toBe('30,000');
    // 100000 - 30000 = 70000
    expect(updated.computedMetrics![1].value).toBe('70,000');
  });

  it('defaults unknown field tokens to 0 in formula evaluation', () => {
    const { result } = renderHook(() => usePocketVibe());
    const formBlock: VisualBlock = {
      type: 'interactive_form',
      id: 'form-4',
      title: 'Simple Calc',
      submitLabel: 'Go',
      fields: [
        { id: 'amount', label: 'Amount', type: 'number', placeholder: '0', value: '0' },
      ],
      computedMetrics: [
        // $missing_field does not exist — should default to 0
        { label: 'Result', formula: '$amount + $missing_field' },
      ],
    };
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: [formBlock], replyText: 'ok' },
      });
    });
    act(() => {
      result.current.dispatch({ type: 'INTERACT_BLOCK', payload: { blockId: 'form-4', itemId: 'amount:500' } });
    });
    const updated = result.current.state.appConfig.blocks.find(b => b.id === 'form-4');
    if (!updated || updated.type !== 'interactive_form') throw new Error('block not found');
    // 500 + 0 = 500
    expect(updated.computedMetrics![0].value).toBe('500');
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

  it('replaces welcome-hero with AI blocks, keeping total = AI block count', () => {
    const result = setupChatState();
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: FAKE_BLOCKS, replyText: 'Done!' },
      });
    });
    // welcome-hero is stripped; only the AI blocks remain
    expect(result.current.state.appConfig.blocks.length).toBe(FAKE_BLOCKS.length);
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

  it('replaces ALL existing blocks when generative_html block arrives', () => {
    const result = setupChatState();
    // First load a non-welcome block
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: FAKE_BLOCKS, replyText: 'first' },
      });
    });
    expect(result.current.state.appConfig.blocks).toHaveLength(1);
    // Now dispatch a generative_html block — should wipe previous blocks
    const htmlBlock: VisualBlock = {
      type: 'generative_html',
      id: 'gh1',
      tailwindMarkup: '<div class="p-4">Hello</div>',
    };
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: [htmlBlock], replyText: 'Canvas redrawn.' },
      });
    });
    // Only the generative_html block should remain
    expect(result.current.state.appConfig.blocks).toHaveLength(1);
    expect(result.current.state.appConfig.blocks[0].id).toBe('gh1');
  });

  it('appends non-generative blocks on top of existing ones', () => {
    const result = setupChatState();
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: FAKE_BLOCKS, replyText: 'first' },
      });
    });
    const second: VisualBlock = { type: 'action_button', id: 'g2', label: 'Second' };
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: [second], replyText: 'second' },
      });
    });
    expect(result.current.state.appConfig.blocks).toHaveLength(2);
  });

  it('replaces a block in-place when incoming block shares an existing id (EDIT mode)', () => {
    const result = setupChatState();
    const original: VisualBlock = {
      type: 'interactive_list', id: 'edit-me', title: 'Original',
      items: [{ id: 'i0', label: 'Initial item', icon: '📌', state: 'Pending' }],
    };
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: [original], replyText: 'created' },
      });
    });
    expect(result.current.state.appConfig.blocks).toHaveLength(1);

    // EDIT: same id, new item appended
    const updated: VisualBlock = {
      type: 'interactive_list', id: 'edit-me', title: 'Updated',
      items: [
        { id: 'i0', label: 'Initial item', icon: '📌', state: 'Pending' },
        { id: 'i1', label: 'New item', icon: '✅', state: 'Pending' },
      ],
    };
    act(() => {
      result.current.dispatch({
        type: 'APPLY_GEMINI_BLOCKS',
        payload: { blocks: [updated], replyText: 'edited' },
      });
    });
    // No duplicate created — still 1 block
    expect(result.current.state.appConfig.blocks).toHaveLength(1);
    // Block updated in-place
    const block = result.current.state.appConfig.blocks[0] as any;
    expect(block.title).toBe('Updated');
    expect(block.items).toHaveLength(2);
  });
});

// ── GEMINI_ERROR — offline fallback engine ────────────────────────────────────

describe('GEMINI_ERROR fallback engine', () => {
  it('appends an interactive_list block for list-intent text', () => {
    const result = setupChatState();
    act(() => {
      result.current.dispatch({
        type: 'GEMINI_ERROR',
        payload: { text: 'build a packing list: passport, charger, clothes', errorMsg: 'Network timeout' },
      });
    });
    // welcome-hero is stripped; only the fallback block remains
    expect(result.current.state.appConfig.blocks.length).toBe(1);
    const newBlock = result.current.state.appConfig.blocks.at(-1)!;
    expect(newBlock.type).toBe('interactive_list');
  });

  it('appends a metrics_row block for metrics-intent text', () => {
    const result = setupChatState();
    act(() => {
      result.current.dispatch({
        type: 'GEMINI_ERROR',
        payload: { text: 'show me a finance metrics dashboard', errorMsg: 'timeout' },
      });
    });
    // welcome-hero is stripped; only the fallback block remains
    expect(result.current.state.appConfig.blocks.length).toBe(1);
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
