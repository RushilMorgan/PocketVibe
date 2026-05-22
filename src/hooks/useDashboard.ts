import { useReducer, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { themes } from '../lib/themes';
import type {
  SiteConfig,
  ThemeName,
  ExtraBlock,
  ExtraBlockType,
  DashboardFocus,
  DashboardThumbPanel,
} from '../types';

// ── State ─────────────────────────────────────────────────────────────────────

interface DashboardState {
  siteConfig: SiteConfig;
  focusedSection: DashboardFocus;
  thumbPanel: DashboardThumbPanel;
  isDirty: boolean;
  isSaving: boolean;
  toast: string | null;
  showAddMenu: boolean;
}

type DashboardAction =
  | { type: 'FOCUS_SECTION'; payload: DashboardFocus }
  | { type: 'UPDATE_TEXT'; payload: { field: 'headline' | 'subheadline'; value: string } }
  | { type: 'SELECT_THEME'; payload: ThemeName }
  | { type: 'ADD_BLOCK'; payload: ExtraBlockType }
  | { type: 'SHOW_ADD_MENU' }
  | { type: 'HIDE_ADD_MENU' }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; payload: string }
  | { type: 'CLEAR_TOAST' };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'FOCUS_SECTION': {
      const s = action.payload;
      let panel: DashboardThumbPanel = 'master';
      if (s === 'background') panel = 'palette';
      else if (s === 'headline' || s === 'subheadline') panel = 'text-edit';
      return { ...state, focusedSection: s, thumbPanel: panel, showAddMenu: false };
    }
    case 'UPDATE_TEXT':
      return {
        ...state,
        isDirty: true,
        siteConfig: { ...state.siteConfig, [action.payload.field]: action.payload.value },
      };
    case 'SELECT_THEME':
      return {
        ...state,
        isDirty: true,
        siteConfig: {
          ...state.siteConfig,
          theme: action.payload,
          colors: themes[action.payload],
        },
      };
    case 'ADD_BLOCK': {
      const block: ExtraBlock = { type: action.payload, id: `${action.payload}-${Date.now()}` };
      return {
        ...state,
        isDirty: true,
        showAddMenu: false,
        thumbPanel: 'master',
        siteConfig: {
          ...state.siteConfig,
          extraBlocks: [...(state.siteConfig.extraBlocks ?? []), block],
        },
      };
    }
    case 'SHOW_ADD_MENU':
      return { ...state, showAddMenu: true };
    case 'HIDE_ADD_MENU':
      return { ...state, showAddMenu: false };
    case 'SAVE_START':
      return { ...state, isSaving: true, toast: null };
    case 'SAVE_SUCCESS':
      return { ...state, isSaving: false, isDirty: false, toast: 'Changes saved and live! ✅' };
    case 'SAVE_ERROR':
      return { ...state, isSaving: false, toast: `Save failed — ${action.payload}` };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboard(initialConfig: SiteConfig) {
  const [state, dispatch] = useReducer(reducer, {
    siteConfig: initialConfig,
    focusedSection: null,
    thumbPanel: 'master',
    isDirty: false,
    isSaving: false,
    toast: null,
    showAddMenu: false,
  });

  // Keep a ref to the latest config so saveChanges always saves the freshest version
  const configRef = useRef(state.siteConfig);
  useEffect(() => {
    configRef.current = state.siteConfig;
  }, [state.siteConfig]);

  const focusSection = useCallback((section: DashboardFocus) => {
    dispatch({ type: 'FOCUS_SECTION', payload: section });
  }, []);

  const updateText = useCallback((field: 'headline' | 'subheadline', value: string) => {
    dispatch({ type: 'UPDATE_TEXT', payload: { field, value } });
  }, []);

  const selectTheme = useCallback((theme: ThemeName) => {
    dispatch({ type: 'SELECT_THEME', payload: theme });
  }, []);

  const addBlock = useCallback((type: ExtraBlockType) => {
    dispatch({ type: 'ADD_BLOCK', payload: type });
  }, []);

  const saveChanges = useCallback(async (siteId: string) => {
    dispatch({ type: 'SAVE_START' });
    const { error } = await supabase
      .from('sites')
      .update({ config: configRef.current })
      .eq('id', siteId);
    if (error) {
      dispatch({ type: 'SAVE_ERROR', payload: error.message });
    } else {
      dispatch({ type: 'SAVE_SUCCESS' });
    }
  }, []);

  return { state, dispatch, focusSection, updateText, selectTheme, addBlock, saveChanges };
}
