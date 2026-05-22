import { useReducer, useCallback, useRef, useEffect } from 'react';
import type {
  PocketVibeState,
  AppConfig,
  GroceryStatus,
  BlueprintId,
  AIArchetype,
  ChatMessage,
  ChoreItem,
  GroceryItem,
  CompanionState,
} from '../types';

// ── Static data ───────────────────────────────────────────────────────────────

const PALETTES = [
  '#7c3aed', '#f43f5e', '#16a34a', '#0ea5e9',
  '#f97316', '#8b5cf6', '#ec4899', '#14b8a6',
];

const HOUSEMATES = ['Alex', 'Jordan', 'Sam', 'Riley', 'Casey'];

const DEFAULT_GROCERY: GroceryItem[] = [
  { id: 'g1', name: 'Oat Milk', emoji: '🥛', status: 'stocked' },
  { id: 'g2', name: 'Sourdough', emoji: '🍞', status: 'low' },
  { id: 'g3', name: 'Avocados', emoji: '🥑', status: 'out' },
  { id: 'g4', name: 'Eggs', emoji: '🥚', status: 'stocked' },
  { id: 'g5', name: 'Pasta', emoji: '🍝', status: 'low' },
  { id: 'g6', name: 'Olive Oil', emoji: '🫙', status: 'stocked' },
];

const DEFAULT_CHORES: ChoreItem[] = [
  { id: 'c1', name: 'Do the dishes', emoji: '🍽️', assignee: null },
  { id: 'c2', name: 'Vacuum living room', emoji: '🧹', assignee: null },
  { id: 'c3', name: 'Take out trash', emoji: '🗑️', assignee: null },
  { id: 'c4', name: 'Clean bathroom', emoji: '🧼', assignee: null },
];

const INITIAL_STATE: PocketVibeState = {
  appConfig: {
    blueprint: 'grocery',
    accentColor: '#7c3aed',
    styleSlider: 30,
    groceryItems: DEFAULT_GROCERY,
    choreItems: DEFAULT_CHORES,
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

// ── Reducer actions ───────────────────────────────────────────────────────────

type PVAction =
  | { type: 'SELECT_ARCHETYPE'; payload: AIArchetype }
  | { type: 'SET_CUSTOM_NAME'; payload: string }
  | { type: 'CONFIRM_COMPANION' }
  | { type: 'SEND_MESSAGE'; payload: string }
  | { type: 'TOGGLE_SIMULATE_PARTNER' }
  | { type: 'SWAP_BLUEPRINT'; payload: BlueprintId }
  | { type: 'CYCLE_GROCERY_STATUS'; payload: string }
  | { type: 'SPIN_CHORES' }
  | { type: 'SET_STYLE_SLIDER'; payload: number }
  | { type: 'SHUFFLE_PALETTE'; payload: string }
  | { type: 'MAKE_PUNCHIER' }
  | { type: 'ADD_SECTION' }
  | { type: 'SET_SHIMMER'; payload: string | null };

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextStatus(s: GroceryStatus): GroceryStatus {
  return s === 'stocked' ? 'low' : s === 'low' ? 'out' : 'stocked';
}

function generateGreeting(archetype: AIArchetype, customName: string): string {
  const name = customName.trim() || archetype.name;
  switch (archetype.id) {
    case 'lex':
      return `Hey. I'm ${name}. Tell me what to build, and I'll keep it sharp.`;
    case 'ziggy':
      return `Yo!! I'm ${name}!! 🎉 Let's make this thing INCREDIBLE!! What vibe are we going for?! 🚀🔥`;
    case 'nova':
      return `Hello. I'm ${name}. I've analyzed your current config. Ready to optimize? What's the priority?`;
  }
}

function generateReply(companion: CompanionState, text: string): string {
  const arc = companion.archetype;
  const lower = text.toLowerCase();
  const name = companion.customName.trim() || arc?.name || 'AI';

  if (lower.includes('green') || lower.includes('background') || lower.includes('color') || lower.includes('palette')) {
    if (arc?.id === 'ziggy') return `GREEN!! Yes!! 🌿🎨 Shuffling the palette to something fresh!!`;
    if (arc?.id === 'lex') return `Palette updated.`;
    return `Initiating palette shuffle. Color change applied.`;
  }
  if (lower.includes('punchier') || lower.includes('bold') || lower.includes('louder')) {
    if (arc?.id === 'ziggy') return `PUNCHIER?! I LIVE FOR THIS!! 💥🔥 Making it hit HARDER!!`;
    if (arc?.id === 'lex') return `Style adjusted. Less noise, more impact.`;
    return `Applying a punchier style modifier. Style score updated.`;
  }
  if (lower.includes('add') || lower.includes('section') || lower.includes('more')) {
    if (arc?.id === 'ziggy') return `MORE STUFF?! 🤩 Adding a brand new section RIGHT NOW!! ✨`;
    if (arc?.id === 'lex') return `Section injected.`;
    return `Injecting a new visual section into the active layout.`;
  }
  if (lower.includes('help') || lower.includes('what can')) {
    if (arc?.id === 'lex') return `Try: "change the color", "make it punchier", "add a section".`;
    if (arc?.id === 'ziggy') return `ANYTHING!! 🎊 Try: "shuffle palette", "make it punchier", "add a section" — LET'S GO!!`;
    return `Available commands: "shuffle the palette", "make it punchier", "add a visual section".`;
  }

  const defaults: Record<string, string[]> = {
    lex: [`Noted.`, `Got it.`, `Working on it.`, `Done.`],
    ziggy: [`OMG YES!! 🎉`, `ON IT!! 🚀`, `This is gonna be EPIC!! 💥`, `YAS!! ✨`],
    nova: [`Processing.`, `Analyzing... applied.`, `Optimization in progress.`, `Request logged.`],
  };
  const pool = defaults[arc?.id ?? 'nova'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: PocketVibeState, action: PVAction): PocketVibeState {
  switch (action.type) {
    case 'SELECT_ARCHETYPE':
      return { ...state, companion: { ...state.companion, archetype: action.payload } };

    case 'SET_CUSTOM_NAME':
      return { ...state, companion: { ...state.companion, customName: action.payload } };

    case 'CONFIRM_COMPANION': {
      const { archetype, customName } = state.companion;
      if (!archetype) return state;
      const greeting: ChatMessage = {
        id: `${Date.now()}-greet`,
        role: 'companion',
        text: generateGreeting(archetype, customName),
      };
      return {
        ...state,
        companion: { ...state.companion, phase: 'chat', messages: [greeting] },
      };
    }

    case 'SEND_MESSAGE': {
      const userMsg: ChatMessage = { id: `${Date.now()}-u`, role: 'user', text: action.payload };
      const replyText = generateReply(state.companion, action.payload);
      const replyMsg: ChatMessage = { id: `${Date.now()}-c`, role: 'companion', text: replyText };
      return {
        ...state,
        companion: { ...state.companion, messages: [...state.companion.messages, userMsg, replyMsg] },
      };
    }

    case 'TOGGLE_SIMULATE_PARTNER':
      return { ...state, simulatePartner: !state.simulatePartner };

    case 'SWAP_BLUEPRINT':
      return { ...state, appConfig: { ...state.appConfig, blueprint: action.payload } };

    case 'CYCLE_GROCERY_STATUS':
      return {
        ...state,
        appConfig: {
          ...state.appConfig,
          groceryItems: state.appConfig.groceryItems.map((item) =>
            item.id === action.payload ? { ...item, status: nextStatus(item.status) } : item
          ),
        },
      };

    case 'SPIN_CHORES':
      return {
        ...state,
        appConfig: {
          ...state.appConfig,
          choreItems: state.appConfig.choreItems.map((item) => ({
            ...item,
            assignee: HOUSEMATES[Math.floor(Math.random() * HOUSEMATES.length)],
          })),
        },
      };

    case 'SET_STYLE_SLIDER':
      return { ...state, appConfig: { ...state.appConfig, styleSlider: action.payload } };

    case 'SHUFFLE_PALETTE':
      return { ...state, appConfig: { ...state.appConfig, accentColor: action.payload } };

    case 'MAKE_PUNCHIER':
      return {
        ...state,
        appConfig: { ...state.appConfig, styleSlider: Math.max(0, state.appConfig.styleSlider - 20) },
      };

    case 'ADD_SECTION': {
      if (state.appConfig.blueprint === 'grocery') {
        const options: GroceryItem[] = [
          { id: `g-x-${Date.now()}`, name: 'Chocolate', emoji: '🍫', status: 'out' },
          { id: `g-x-${Date.now() + 1}`, name: 'Ice Cream', emoji: '🍦', status: 'stocked' },
          { id: `g-x-${Date.now() + 2}`, name: 'Pizza', emoji: '🍕', status: 'low' },
        ];
        const pick = options[Math.floor(Math.random() * options.length)];
        return {
          ...state,
          appConfig: { ...state.appConfig, groceryItems: [...state.appConfig.groceryItems, pick] },
        };
      } else {
        const options: ChoreItem[] = [
          { id: `c-x-${Date.now()}`, name: 'Water plants', emoji: '🪴', assignee: null },
          { id: `c-x-${Date.now() + 1}`, name: 'Feed the fish', emoji: '🐟', assignee: null },
          { id: `c-x-${Date.now() + 2}`, name: 'Fold laundry', emoji: '👕', assignee: null },
        ];
        const pick = options[Math.floor(Math.random() * options.length)];
        return {
          ...state,
          appConfig: { ...state.appConfig, choreItems: [...state.appConfig.choreItems, pick] },
        };
      }
    }

    case 'SET_SHIMMER':
      return { ...state, shimmeringBlockId: action.payload };

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePocketVibe() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const shimmerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shimmerTimerRef.current) clearTimeout(shimmerTimerRef.current);
    };
  }, []);

  const shimmerThen = useCallback((blockId: string, mutate: () => void) => {
    if (shimmerTimerRef.current) clearTimeout(shimmerTimerRef.current);
    dispatch({ type: 'SET_SHIMMER', payload: blockId });
    shimmerTimerRef.current = setTimeout(() => {
      dispatch({ type: 'SET_SHIMMER', payload: null });
      mutate();
    }, 1000);
  }, []);

  const shufflePaletteWithShimmer = useCallback((blueprint: BlueprintId, currentColor: string) => {
    const blockId = blueprint === 'grocery' ? 'grocery-grid' : 'chore-spin';
    const idx = (PALETTES.indexOf(currentColor) + 1) % PALETTES.length;
    shimmerThen(blockId, () => dispatch({ type: 'SHUFFLE_PALETTE', payload: PALETTES[idx] }));
  }, [shimmerThen]);

  const makePunchierWithShimmer = useCallback((blueprint: BlueprintId) => {
    const blockId = blueprint === 'grocery' ? 'grocery-grid' : 'chore-spin';
    shimmerThen(blockId, () => dispatch({ type: 'MAKE_PUNCHIER' }));
  }, [shimmerThen]);

  const addSectionWithShimmer = useCallback((blueprint: BlueprintId) => {
    const blockId = blueprint === 'grocery' ? 'grocery-grid' : 'chore-spin';
    shimmerThen(blockId, () => dispatch({ type: 'ADD_SECTION' }));
  }, [shimmerThen]);

  const spinChores = useCallback(() => {
    shimmerThen('chore-spin', () => dispatch({ type: 'SPIN_CHORES' }));
  }, [shimmerThen]);

  const sendMessageWithEffect = useCallback(
    (text: string, blueprint: BlueprintId, accentColor: string) => {
      dispatch({ type: 'SEND_MESSAGE', payload: text });
      const lower = text.toLowerCase();
      if (lower.includes('green') || lower.includes('background') || lower.includes('color') || lower.includes('palette')) {
        shufflePaletteWithShimmer(blueprint, accentColor);
      } else if (lower.includes('punchier') || lower.includes('bold') || lower.includes('louder')) {
        makePunchierWithShimmer(blueprint);
      } else if (lower.includes('add') || lower.includes('section') || lower.includes('more')) {
        addSectionWithShimmer(blueprint);
      }
    },
    [shufflePaletteWithShimmer, makePunchierWithShimmer, addSectionWithShimmer]
  );

  return {
    state,
    dispatch,
    shufflePaletteWithShimmer,
    makePunchierWithShimmer,
    addSectionWithShimmer,
    spinChores,
    sendMessageWithEffect,
  };
}
