import { useReducer } from 'react';
import type {
  SiteBuilderState,
  SiteBuilderAction,
  SiteConfig,
  ThemeName,
} from '../types';
import { themes } from '../lib/themes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

// ── Default state ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SiteConfig = {
  businessName: 'Paws & Suds Mobile Grooming',
  businessDescription: 'Mobile dog washing',
  theme: 'default',
  colors: themes['default'],
  headline: 'Professional Doggie Spa Day, Right in Your Driveway',
  subheadline: 'We come to you — no stress, no mess. Just a happy, clean pup!',
  ctaText: 'Check Availability',
  subdomain: 'pawsandsuds.everysite.com',
  isPublished: false,
};

const INITIAL_STATE: SiteBuilderState = {
  siteConfig: DEFAULT_CONFIG,
  onboardingStep: 'input',
  bottomSheetContext: 'idle',
  activeComponent: null,
  showLaunchModal: false,
};

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: SiteBuilderState, action: SiteBuilderAction): SiteBuilderState {
  switch (action.type) {
    case 'SET_BUSINESS_INFO': {
      const slug = slugify(action.payload.businessName);
      return {
        ...state,
        siteConfig: {
          ...state.siteConfig,
          businessName: action.payload.businessName,
          businessDescription: action.payload.businessDescription,
          subdomain: `${slug}.everysite.com`,
        },
      };
    }

    case 'START_ANIMATION': {
      return { ...state, onboardingStep: 'animating' };
    }

    case 'ANIMATION_COMPLETE': {
      return {
        ...state,
        onboardingStep: 'interactive',
        bottomSheetContext: 'nudge',
      };
    }

    case 'TAP_CANVAS_ELEMENT': {
      if (state.onboardingStep !== 'interactive') return state;
      // During nudge/idle phases, any canvas tap opens the palette picker
      if (state.bottomSheetContext === 'nudge' || state.bottomSheetContext === 'idle') {
        return {
          ...state,
          activeComponent: action.payload,
          bottomSheetContext: 'palette',
        };
      }
      // After palette is shown, canvas taps update the active component for context
      return { ...state, activeComponent: action.payload };
    }

    case 'SELECT_PALETTE': {
      const themeName = action.payload as ThemeName;
      return {
        ...state,
        siteConfig: {
          ...state.siteConfig,
          theme: themeName,
          colors: themes[themeName],
        },
        bottomSheetContext: 'launch',
      };
    }

    case 'SHOW_LAUNCH': {
      return { ...state, showLaunchModal: true };
    }

    case 'CLOSE_MODAL': {
      return { ...state, showLaunchModal: false };
    }

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSiteBuilder() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  return { state, dispatch };
}
