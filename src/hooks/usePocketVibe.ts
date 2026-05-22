import { useReducer, useRef, useEffect } from 'react';
import type {
  PocketVibeState,
  AIArchetype,
  ChatMessage,
  VisualBlock,
  InteractiveListItem,
  AppConfig,
} from '../types';

// Unused import kept to satisfy type re-export
void (null as unknown as AppConfig);

// ── Palette cycle ─────────────────────────────────────────────────────────────

const PALETTES = ['#7c3aed', '#f43f5e', '#16a34a', '#0ea5e9', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6'];

// ── Intent keyword sets ───────────────────────────────────────────────────────

const LIST_KW = new Set([
  'list', 'track', 'tasks', 'task', 'todo', 'checklist', 'pack', 'packing',
  'build', 'create', 'make', 'add', 'construct', 'generate',
  'items', 'tools', 'tracker', 'supplies', 'log', 'inventory',
  'gear', 'goals', 'things', 'stuff', 'workspace', 'gym', 'fitness',
  'workout', 'shopping', 'grocery', 'groceries',
]);

const METRICS_KW = new Set([
  'metric', 'metrics', 'stats', 'stat', 'score', 'count', 'counter',
  'finance', 'financial', 'data', 'number', 'numbers', 'analytics',
  'dashboard', 'progress', 'total', 'sum', 'amount', 'balance',
  'weekly', 'daily', 'monthly', 'active',
]);

const BUTTON_KW = new Set([
  'button', 'action', 'cta', 'click', 'trigger', 'submit', 'launch', 'tap', 'press',
]);

const HERO_KW = new Set([
  'hero', 'header', 'banner', 'title', 'welcome', 'intro', 'cover', 'heading',
]);

// ── Style mutation tokens ─────────────────────────────────────────────────────

interface StyleToken {
  words: string[];
  color: string;
  slider: number;
  label: string;
}

const STYLE_TOKENS: StyleToken[] = [
  { words: ['neon', 'cyberpunk', 'electric', 'matrix', 'glitch'],  color: '#00ff87', slider: 15, label: 'cyberpunk neon'  },
  { words: ['fire', 'warm', 'energetic', 'hot', 'energy', 'sunset'], color: '#f97316', slider: 15, label: 'energetic warm'  },
  { words: ['ocean', 'blue', 'sky', 'cool', 'aqua'],               color: '#0ea5e9', slider: 45, label: 'ocean blue'      },
  { words: ['pastel', 'pink', 'soft', 'gentle', 'dreamy'],         color: '#ec4899', slider: 25, label: 'pastel pink'     },
  { words: ['dark', 'midnight', 'night', 'shadow', 'stealth'],     color: '#1e293b', slider: 80, label: 'dark midnight'   },
  { words: ['forest', 'nature', 'green', 'eco', 'natural'],        color: '#16a34a', slider: 30, label: 'forest green'    },
  { words: ['cosmic', 'galaxy', 'purple', 'violet', 'space'],      color: '#7c3aed', slider: 20, label: 'cosmic violet'   },
  { words: ['cherry', 'red', 'ruby', 'crimson'],                   color: '#f43f5e', slider: 20, label: 'cherry red'      },
  { words: ['teal', 'clean', 'fresh', 'mint'],                     color: '#14b8a6', slider: 55, label: 'teal clean'      },
  { words: ['gold', 'luxury', 'premium', 'royal', 'amber'],        color: '#eab308', slider: 35, label: 'luxury gold'     },
];

// ── Icon inference ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, string> = {
  // Tools
  saw: '🪚', hammer: '🔨', drill: '🔧', wrench: '🔧', screwdriver: '🪛',
  tool: '🧰', tools: '🧰', laptop: '💻', phone: '📱', computer: '🖥️',
  keyboard: '⌨️', monitor: '🖥️', desk: '🪑', office: '🏢',
  // Fitness
  run: '🏃', running: '🏃', gym: '🏋️', workout: '💪', exercise: '⚡',
  yoga: '🧘', swim: '🏊', bike: '🚴', walk: '🚶',
  stretch: '🧘', water: '💧', sleep: '😴', medicine: '💊', health: '❤️',
  // Food
  milk: '🥛', coffee: '☕', bread: '🍞', egg: '🥚', eggs: '🥚',
  apple: '🍎', banana: '🍌', avocado: '🥑', pasta: '🍝', rice: '🍚',
  cheese: '🧀', butter: '🧈', cereal: '🥣', fruit: '🍇',
  // Travel
  passport: '🛂', ticket: '🎫', hotel: '🏨', flight: '✈️', bag: '🧳',
  camera: '📷', charger: '🔌', cable: '🔌', adapter: '🔌', sunscreen: '🧴',
  book: '📖', headphone: '🎧', headphones: '🎧', clothes: '👕', clothing: '👕',
  // Finance
  money: '💰', budget: '💵', invoice: '🧾', tax: '📊', bank: '🏦',
  bill: '📋', savings: '💸', invest: '📈', stock: '📉', crypto: '🪙',
  salary: '💰', expense: '💳', card: '💳', rent: '🏠',
  // Work
  meeting: '📅', email: '📧', call: '📞', document: '📄', report: '📊',
  project: '📁', deadline: '⏰', presentation: '🎯', review: '🔍',
  plan: '🗓️', goal: '🎯', target: '🎯',
  // Generic
  item: '📌', task: '✅', step: '➡️', idea: '💡', note: '📝',
};

function inferIcon(word: string): string {
  const w = word.toLowerCase().replace(/s$/, ''); // naive singular
  if (ICON_MAP[w]) return ICON_MAP[w];
  if (ICON_MAP[word.toLowerCase()]) return ICON_MAP[word.toLowerCase()];
  for (const key of Object.keys(ICON_MAP)) {
    if (w.includes(key) || key.includes(w)) return ICON_MAP[key];
  }
  return '📌';
}

// ── Contextual default items/metrics ─────────────────────────────────────────

function getContextualDefaults(lower: string): InteractiveListItem[] {
  if (/pack|travel|trip|suitcase|luggage/.test(lower)) return [
    { id: 'cd1', label: 'Passport & travel docs', icon: '🛂', state: 'Pending' },
    { id: 'cd2', label: 'Phone charger & cables', icon: '🔌', state: 'Pending' },
    { id: 'cd3', label: 'Clothing & toiletries',  icon: '👕', state: 'Pending' },
    { id: 'cd4', label: 'Camera & adapters',      icon: '📷', state: 'Pending' },
  ];
  if (/gym|fitness|workout|exercise|run|training/.test(lower)) return [
    { id: 'cd1', label: 'Morning 5k run',     icon: '🏃', state: 'Pending' },
    { id: 'cd2', label: 'Core circuit x3',   icon: '💪', state: 'Pending' },
    { id: 'cd3', label: 'Cooldown stretch',  icon: '🧘', state: 'Pending' },
  ];
  if (/finance|budget|money|spend|expense|bill/.test(lower)) return [
    { id: 'cd1', label: 'Check account balance',   icon: '💰', state: 'Pending' },
    { id: 'cd2', label: 'Log monthly expenses',    icon: '📊', state: 'Pending' },
    { id: 'cd3', label: 'Transfer to savings',     icon: '💸', state: 'Pending' },
  ];
  if (/grocery|shop|food|supermarket/.test(lower)) return [
    { id: 'cd1', label: 'Fresh produce',       icon: '🥦', state: 'Needed' },
    { id: 'cd2', label: 'Pantry essentials',   icon: '🛒', state: 'Needed' },
    { id: 'cd3', label: 'Dairy & eggs',        icon: '🥛', state: 'Stocked' },
  ];
  if (/work|office|project|workspace|task|todo/.test(lower)) return [
    { id: 'cd1', label: 'Code review',      icon: '👨‍💻', state: 'Pending' },
    { id: 'cd2', label: 'Team standup',     icon: '📅', state: 'Pending' },
    { id: 'cd3', label: 'Ship feature',     icon: '🚀', state: 'Pending' },
  ];
  return [
    { id: 'cd1', label: 'Priority item one',   icon: '📌', state: 'Pending' },
    { id: 'cd2', label: 'Priority item two',   icon: '📌', state: 'Pending' },
    { id: 'cd3', label: 'Priority item three', icon: '📌', state: 'Pending' },
  ];
}

function getContextualMetrics(lower: string): { label: string; value: string }[] {
  if (/finance|money|budget|expense|earn/.test(lower)) return [
    { label: 'Balance',     value: '$4,200' },
    { label: 'Expenses',   value: '$1,820' },
    { label: 'Savings',    value: '43%'    },
    { label: 'Net Worth',  value: '$12.5k' },
  ];
  if (/fitness|workout|gym|health|run/.test(lower)) return [
    { label: 'Streak',      value: '12 days' },
    { label: 'Calories',   value: '2,150'   },
    { label: 'Steps',      value: '8,240'   },
    { label: 'Active',     value: '47 min'  },
  ];
  if (/sleep|recovery|biometric/.test(lower)) return [
    { label: 'Sleep Score', value: '84%'    },
    { label: 'HRV',         value: '58 ms'  },
    { label: 'Resting HR',  value: '62 bpm' },
    { label: 'Recovery',    value: '91%'    },
  ];
  return [
    { label: 'Total',   value: '1,024' },
    { label: 'Active',  value: '87%'   },
    { label: 'Growth',  value: '+12%'  },
    { label: 'Score',   value: '9.2'   },
  ];
}

// ── Natural language item extractor ──────────────────────────────────────────

function extractItems(text: string): InteractiveListItem[] {
  // Look for colon or dash delimiter: "...tools: saws, hammer, drill"
  const delimIdx = text.search(/[:\-–]/);
  if (delimIdx !== -1) {
    const afterDelim = text.slice(delimIdx + 1).trim();
    const raw = afterDelim.split(/[,;]+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 60);
    if (raw.length >= 2) {
      return raw.map((label, i) => ({
        id: `ei-${Date.now()}-${i}`,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        icon: inferIcon(label.split(' ')[0]),
        state: 'Pending',
      }));
    }
  }
  // Fallback: inline comma list with 3+ short tokens (no colon needed)
  const commaParts = text.split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 40 && !s.includes(' ') === false);
  if (commaParts.length >= 3) {
    return commaParts.map((label, i) => ({
      id: `ei-${Date.now()}-${i}`,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      icon: inferIcon(label.split(' ')[0]),
      state: 'Pending',
    }));
  }
  return [];
}

// ── Title extractor ───────────────────────────────────────────────────────────

function extractTitle(text: string): string {
  const textBeforeColon = text.search(/[:\-–]/) !== -1
    ? text.slice(0, text.search(/[:\-–]/)).trim()
    : text;

  // "for my X" or "for our X" or "for the X"
  const forMatch = textBeforeColon.match(/for\s+(?:my|our|the)?\s*([a-zA-Z\s]+?)(?:\s*$)/i);
  if (forMatch) {
    const raw = forMatch[1].trim().replace(/\s+/g, ' ');
    if (raw.length > 2 && raw.length < 50) {
      return raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  // "a X list|tracker|log|block|section|counter|dashboard"
  const aMatch = textBeforeColon.match(/(?:a|an)\s+([a-zA-Z\s]+?)\s+(?:list|tracker|log|block|section|counter|dashboard)/i);
  if (aMatch) {
    const raw = aMatch[1].trim().replace(/\s+/g, ' ');
    if (raw.length > 2 && raw.length < 50) {
      return raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  // "Build|Create|Generate|Track X"
  const verbMatch = textBeforeColon.match(/(?:build|create|generate|track|make|add|construct)\s+(?:a\s+|an\s+)?([a-zA-Z\s]+?)(?:\s*$)/i);
  if (verbMatch) {
    const raw = verbMatch[1].trim().replace(/\s+/g, ' ');
    if (raw.length > 2 && raw.length < 50) {
      return raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return 'New Block';
}

// ── Archetype-aware reply generator ──────────────────────────────────────────

function generateReply(
  archetype: AIArchetype | null,
  intent: string | null,
  detail: string,
): string {
  const id = archetype?.id ?? 'nova';
  const map: Record<string, Record<string, string>> = {
    interactive_list: {
      lex:   `List constructed: "${detail}". Items live on canvas.`,
      ziggy: `YO!! "${detail}" is LIVE!! 🔥 I parsed your items and rendered them INSTANTLY!! ✨`,
      nova:  `Interactive list generated: "${detail}". Input tokens parsed and mapped to contextual icons.`,
    },
    metrics_row: {
      lex:   `Metrics injected. Data cards rendering below.`,
      ziggy: `NUMBERS!! 📈 Your "${detail}" analytics block is ALIVE on the canvas!! 🎉`,
      nova:  `Metrics row generated for "${detail}". Statistical tiles now visible in the layout.`,
    },
    action_button: {
      lex:   `Action button placed.`,
      ziggy: `BUTTON DROPPED!! 🚀 Tap it!! Do it!! 🎉`,
      nova:  `Action button appended. CTA element rendered at bottom of current layout stack.`,
    },
    hero_banner: {
      lex:   `Hero block placed. Clean.`,
      ziggy: `BANNER UP!! 🏆 Looking ICONIC right now!! ✨`,
      nova:  `Hero banner generated: "${detail}". Welcome structure initialized.`,
    },
    style: {
      lex:   `Design tokens updated. ${detail}`,
      ziggy: `VIBES CHANGED!! ${detail} 🎨🔥`,
      nova:  `Global design token mutation applied. ${detail}`,
    },
    clear: {
      lex:   `Canvas cleared.`,
      ziggy: `FRESH CANVAS!! Let's build something EPIC!! 🎨`,
      nova:  `Canvas state reset. All blocks removed. Ready for new layout generation.`,
    },
    fallback: {
      lex:   `Try: "list: item1, item2" or a style token like "cyberpunk".`,
      ziggy: `Hmm!! 🤔 Try: "build a packing list: passport, charger, clothes" or just say "neon theme"!! LET'S GO!!`,
      nova:  `Intent unclear. Try: "list for [context]: item1, item2" or a style token like "dark midnight".`,
    },
  };
  return (map[intent ?? 'fallback'] ?? map.fallback)[id];
}

// ── Preset blocks ─────────────────────────────────────────────────────────────

const WELCOME_BLOCKS: VisualBlock[] = [
  {
    type: 'hero_banner',
    id: 'welcome-hero',
    title: 'Your Generative Canvas',
    subtitle: 'Initialize your AI companion below — then type or tap to generate any micro-app layout from pure intent.',
    ctaLabel: '✨ Start Generating',
  },
];

const GROCERY_PRESET: VisualBlock[] = [
  { type: 'hero_banner', id: 'gp-hero', title: 'Pantry Tracker', subtitle: 'Tap any item to cycle its stock status.', ctaLabel: 'View Full List' },
  { type: 'interactive_list', id: 'gp-list', title: 'Pantry', items: [
    { id: 'gp1', label: 'Oat Milk',     icon: '🥛', state: 'Stocked' },
    { id: 'gp2', label: 'Avocados',     icon: '🥑', state: 'Out'     },
    { id: 'gp3', label: 'Coffee Beans', icon: '☕', state: 'Low'     },
    { id: 'gp4', label: 'Sourdough',    icon: '🍞', state: 'Stocked' },
  ]},
];

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: PocketVibeState = {
  appConfig: {
    blocks: WELCOME_BLOCKS,
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
      return { ...state, appConfig: { ...state.appConfig, blocks: action.payload === 'grocery' ? GROCERY_PRESET : WELCOME_BLOCKS } };

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
      // Tokenize: split on whitespace + punctuation, filter short noise words
      const tokens = lower.split(/[\s,;:!?.\-–]+/).filter(t => t.length > 1);

      const userMsg: ChatMessage = { id: `${Date.now()}-u`, role: 'user', text };
      let newBlocks = [...state.appConfig.blocks];
      let newColor = state.appConfig.accentColor;
      let newSlider = state.appConfig.styleSlider;
      let targetShimmer: string | null = null;
      let replyIntent: string | null = null;
      let replyDetail = '';

      // ── Step 1: Canvas control commands ──────────────────────────────────────
      if (/\bclear\b|\breset canvas\b|\bstart over\b|\bempty canvas\b/.test(lower)) {
        newBlocks = WELCOME_BLOCKS;
        targetShimmer = 'canvas-root';
        replyIntent = 'clear';
        replyDetail = '';
      }

      // ── Step 2: Style token mutations ─────────────────────────────────────────
      const styleMatch = STYLE_TOKENS.find(s => s.words.some(w => lower.includes(w)));
      if (styleMatch) {
        newColor = styleMatch.color;
        newSlider = styleMatch.slider;
        targetShimmer = 'canvas-root';
        replyIntent = 'style';
        replyDetail = `${styleMatch.label} visual theme activated across all design tokens.`;
      }

      // Palette cycle (explicit shuffle/cycle request)
      if (/shuffle|cycle.*palette|palette.*cycle|next.*color/.test(lower)) {
        const curIdx = PALETTES.indexOf(state.appConfig.accentColor);
        newColor = PALETTES[(curIdx + 1) % PALETTES.length];
        targetShimmer = 'canvas-root';
        replyIntent = 'style';
        replyDetail = 'Accent palette cycled to the next spectrum color.';
      }

      // Playfulness modifiers
      if (/punchier|make.*punchy|more.*bold|bolder/.test(lower)) {
        newSlider = Math.max(0, newSlider - 25);
        if (!targetShimmer) targetShimmer = 'canvas-root';
        replyIntent = 'style';
        replyDetail = 'Style tokens shifted more playful — bolder radii, expressive weights.';
      }
      if (/\bminimal\b|\bminimalist\b|\bcleaner\b|\bsimpler\b/.test(lower)) {
        newSlider = Math.min(100, newSlider + 25);
        if (!targetShimmer) targetShimmer = 'canvas-root';
        replyIntent = 'style';
        replyDetail = 'Style tokens shifted minimalist — reduced decoration and tighter spacing.';
      }

      // ── Step 3: Score intent for layout block generation ──────────────────────
      if (replyIntent !== 'clear') {
        const scores = { list: 0, metrics: 0, action_button: 0, hero: 0 };
        for (const token of tokens) {
          if (LIST_KW.has(token))   scores.list++;
          if (METRICS_KW.has(token)) scores.metrics++;
          if (BUTTON_KW.has(token)) scores.action_button++;
          if (HERO_KW.has(token))   scores.hero++;
        }

        // Detect implicit comma list (3+ comma-separated items without explicit intent)
        const commaParts = text.split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 50);
        if (commaParts.length >= 3 && scores.list === 0 && scores.metrics === 0) {
          scores.list += 5; // implicit list detected
        }

        const topEntry = (Object.entries(scores) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
        const topIntent = topEntry[0];
        const hasIntent = topEntry[1] > 0;

        if (hasIntent) {
          const id = `gen-${Date.now()}`;
          const title = extractTitle(text);

          if (topIntent === 'list') {
            const extracted = extractItems(text);
            const items = extracted.length >= 2 ? extracted : getContextualDefaults(lower);
            const block: VisualBlock = { type: 'interactive_list', id, title, items };
            newBlocks.push(block);
            targetShimmer = id;
            replyIntent = 'interactive_list';
            replyDetail = title;
          }
          else if (topIntent === 'metrics') {
            const metrics = getContextualMetrics(lower);
            const block: VisualBlock = { type: 'metrics_row', id, metrics };
            newBlocks.push(block);
            targetShimmer = id;
            replyIntent = 'metrics_row';
            replyDetail = title;
          }
          else if (topIntent === 'action_button') {
            const label = title !== 'New Block' ? title : '✨ Execute Action';
            const block: VisualBlock = { type: 'action_button', id, label, icon: '🚀' };
            newBlocks.push(block);
            targetShimmer = id;
            replyIntent = 'action_button';
            replyDetail = label;
          }
          else if (topIntent === 'hero') {
            const block: VisualBlock = {
              type: 'hero_banner', id,
              title: title !== 'New Block' ? title : 'New Layout Frame',
              subtitle: 'Auto-generated from your input prompt.',
              ctaLabel: 'Explore →',
            };
            newBlocks.push(block);
            targetShimmer = id;
            replyIntent = 'hero_banner';
            replyDetail = block.title;
          }
        }
      }

      const replyText = generateReply(state.companion.archetype, replyIntent, replyDetail);
      const aiReply: ChatMessage = { id: `${Date.now()}-c`, role: 'companion', text: replyText };

      return {
        ...state,
        appConfig: { ...state.appConfig, blocks: newBlocks, accentColor: newColor, styleSlider: newSlider },
        companion: { ...state.companion, messages: [...state.companion.messages, userMsg, aiReply] },
        shimmeringBlockId: targetShimmer,
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