import { useReducer, useCallback, useRef, useEffect } from 'react';
import type {
  PocketVibeState,
  AppConfig,
  AIArchetype,
  ChatMessage,
  VisualBlock,
  CompanionState,
} from '../types';

const PALETTES = ['#7c3aed', '#f43f5e', '#16a34a', '#0ea5e9', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6'];

const BLANK_PRESET: VisualBlock[] = [];

const GROCERY_PRESET: VisualBlock[] = [
  { type: 'hero_banner', id: 'hero-1', title: 'Inventory Tracker', subtitle: 'Universal list syncing algorithm.', ctaLabel: 'Checkout List' },
  { type: 'interactive_list', id: 'list-1', title: 'Groceries', items: [
    { id: 'i1', label: 'Oat Milk', icon: '🥛', state: 'Stocked' },
    { id: 'i2', label: 'Avocados', icon: '🥑', state: 'Out' },
    { id: 'i3', label: 'Coffee Beans', icon: '☕', state: 'Low' }
  ]}
];

const INITIAL_STATE: PocketVibeState = {
  appConfig: {
    blocks: GROCERY_PRESET,
    accentColor: '#7c3aed',
    styleSlider: 30,
  },
  companion: {
    archetype: null,
    customName: '',
    phase: 'onboarding',
    messages: [],
  },
  simulatePartner: false,
  shimmeringBlockId: null,
};

type PVAction =
  | { type: 'SELECT_ARCHETYPE'; payload: AIArchetype }
  | { type: 'SET_CUSTOM_NAME'; payload: string }
  | { type: 'CONFIRM_COMPANION' }
  | { type: 'TOGGLE_SIMULATE_PARTNER' }
  | { type: 'LOAD_PRESET'; payload: 'grocery' | 'blank' }
  | { type: 'SET_STYLE_SLIDER'; payload: number }
  | { type: 'INTERACT_BLOCK'; payload: { blockId: string; itemId?: string } }
  | { type: 'SET_SHIMMER'; payload: string | null }
  | { type: 'PROCESS_LLM_PROMPT'; payload: string };

function reducer(state: PocketVibeState, action: PVAction): PocketVibeState {
  switch (action.type) {
    case 'SELECT_ARCHETYPE':
      return { ...state, companion: { ...state.companion, archetype: action.payload } };

    case 'SET_CUSTOM_NAME':
      return { ...state, companion: { ...state.companion, customName: action.payload } };

    case 'CONFIRM_COMPANION': {
      const { archetype, customName } = state.companion;
      const greeting: ChatMessage = {
        id: `${Date.now()}-greet`,
        role: 'companion',
        text: `Hey. I'm ${customName.trim() || archetype?.name}. Tell me what app elements to generate.`,
      };
      return { ...state, companion: { ...state.companion, phase: 'chat', messages: [greeting] } };
    }

    case 'TOGGLE_SIMULATE_PARTNER':
      return { ...state, simulatePartner: !state.simulatePartner };

    case 'LOAD_PRESET':
      return { ...state, appConfig: { ...state.appConfig, blocks: action.payload === 'grocery' ? GROCERY_PRESET : BLANK_PRESET } };

    case 'SET_STYLE_SLIDER':
      return { ...state, appConfig: { ...state.appConfig, styleSlider: action.payload } };

    case 'INTERACT_BLOCK': {
      const { blockId, itemId } = action.payload;
      return {
        ...state,
        shimmeringBlockId: blockId,
        appConfig: {
          ...state.appConfig,
          blocks: state.appConfig.blocks.map(b => {
            if (b.id !== blockId) return b;
            if (b.type === 'interactive_list' && itemId) {
              return {
                ...b,
                items: b.items.map(i => {
                  if (i.id !== itemId) return i;
                  const nextState = i.state === 'Stocked' ? 'Low' : i.state === 'Low' ? 'Out' : i.state === 'Out' ? 'Stocked' : i.state === 'Done' ? 'Pending' : 'Done';
                  return { ...i, state: nextState };
                })
              };
            }
            return b;
          })
        }
      };
    }

    case 'PROCESS_LLM_PROMPT': {
      const text = action.payload;
      const lower = text.toLowerCase();
      const userMsg: ChatMessage = { id: `${Date.now()}-u`, role: 'user', text };
      
      let replyText = "I processed your request, but couldn't attach any specific generative UI blocks to that prompt. Try asking for 'fitness log' or 'metrics'.";
      let targetShimmer: string | null = null;
      let newBlocks = [...state.appConfig.blocks];
      let newColor = state.appConfig.accentColor;
      let newSlider = state.appConfig.styleSlider;

      if (lower.includes('fitness') || lower.includes('workout')) {
        const genBlock: VisualBlock = { type: 'interactive_list', id: `gen-${Date.now()}`, title: 'Generated: Fitness Tracker', items: [ { id: 'f1', label: 'Morning 5k', icon: '🏃', state: 'Pending' }, { id: 'f2', label: 'Core Routine', icon: '💪', state: 'Pending' } ] };
        newBlocks.push(genBlock);
        replyText = "Generated a tactile fitness tracker dynamically.";
        targetShimmer = genBlock.id;
      }
      else if (lower.includes('metric') || lower.includes('stats')) {
        const genBlock: VisualBlock = { type: 'metrics_row', id: `gen-${Date.now()}`, metrics: [ { label: 'Streak', value: '12 Days' }, { label: 'Score', value: '4,200' } ] };
        newBlocks.push(genBlock);
        replyText = "Injected purely generative analytics metrics into the active layout.";
        targetShimmer = genBlock.id;
      }
      else if (lower.includes('button') || lower.includes('action')) {
        const genBlock: VisualBlock = { type: 'action_button', id: `gen-${Date.now()}`, label: '✨ Do Something Awesome', icon: '🚀' };
        newBlocks.push(genBlock);
        replyText = "Added a heavy action button to the bottom layout layer.";
        targetShimmer = genBlock.id;
      }
      else if (lower.includes('hero') || lower.includes('header')) {
        const genBlock: VisualBlock = { type: 'hero_banner', id: `gen-${Date.now()}`, title: 'Generative Canvas', subtitle: 'Built from pure intent JSONs.', ctaLabel: 'Get Started' };
        newBlocks.push(genBlock);
        replyText = "Appended a new Hero Banner format to the canvas structure.";
        targetShimmer = genBlock.id;
      }
      else if (lower.includes('list')) {
        const genBlock: VisualBlock = { type: 'interactive_list', id: `gen-${Date.now()}`, title: 'Generated List', items: [ { id: 'l1', label: 'Item A', icon: '📦', state: 'Pending' }, { id: 'l2', label: 'Item B', icon: '📦', state: 'Pending' } ] };
        newBlocks.push(genBlock);
        replyText = "Appended a new scalable generic list.";
        targetShimmer = genBlock.id;
      }
      
      if (lower.includes('color') || lower.includes('palette') || lower.includes('shuffle')) {
        const curIdx = PALETTES.indexOf(state.appConfig.accentColor) || 0;
        newColor = PALETTES[(curIdx + 1) % PALETTES.length];
        replyText = targetShimmer ? replyText + " (Also shuffled the root palette!)" : "Universal layout colors completely mutated!";
        if (!targetShimmer) targetShimmer = 'canvas-root';
      }

      if (lower.includes('punchier') || lower.includes('bold')) {
        newSlider = Math.max(0, newSlider - 30);
        replyText = targetShimmer ? replyText + " (Applied punchy style tokens!)" : "Style tokens modified to be punchier. Round borders, heavier font weights applied.";
        if (!targetShimmer) targetShimmer = 'canvas-root';
      }
      
      const aiReply: ChatMessage = { id: `${Date.now()}-c`, role: 'companion', text: replyText };

      return {
        ...state,
        appConfig: { ...state.appConfig, blocks: newBlocks, accentColor: newColor, styleSlider: newSlider },
        companion: { ...state.companion, messages: [...state.companion.messages, userMsg, aiReply] },
        shimmeringBlockId: targetShimmer
      };
    }

    case 'SET_SHIMMER':
      return { ...state, shimmeringBlockId: action.payload };

    default:
      return state;
  }
}

export function usePocketVibe() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const shimmerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.shimmeringBlockId) {
      if (shimmerTimerRef.current) clearTimeout(shimmerTimerRef.current);
      shimmerTimerRef.current = setTimeout(() => {
        dispatch({ type: 'SET_SHIMMER', payload: null });
      }, 1000);
    }
  }, [state.shimmeringBlockId]);

  return { state, dispatch };
}