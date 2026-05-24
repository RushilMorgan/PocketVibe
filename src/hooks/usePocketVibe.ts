import { useReducer, useEffect, useCallback, useRef } from 'react';
import type {
  PocketVibeState,
  AppView,
  Creation,
  CreationContent,
  PendingAction,
  ChatMessage,
  GenerationMode,
  GenerateRequest,
} from '../types';
import { generateCreation, generateOfflineFallback, AIConfigError } from '../services/aiService';
import {
  loadCreations,
  saveCreations,
  loadActiveCreationId,
  saveActiveCreationId,
  upsertCreation,
  deleteCreationById,
} from '../lib/creationStore';

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: PocketVibeState = {
  view: 'home',
  creations: [],
  activeCreationId: null,
  isGenerating: false,
  processingStatus: null,
  pendingAction: null,
  messages: [],
  accentColor: '#7c3aed',
};

// ── Actions ───────────────────────────────────────────────────────────────────

type PVAction =
  | { type: 'HYDRATE'; payload: { creations: Creation[]; activeCreationId: string | null } }
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'UPSERT_CREATION'; payload: Creation }
  | { type: 'DELETE_CREATION'; payload: string }
  | { type: 'SET_ACTIVE_CREATION'; payload: string | null }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_PROCESSING_STATUS'; payload: string | null }
  | { type: 'SET_PENDING_ACTION'; payload: PendingAction | null }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'UPDATE_CREATION_CONTENT'; payload: { id: string; content: CreationContent } }
  | { type: 'RENAME_CREATION'; payload: { id: string; title: string } }
  | { type: 'SET_ACCENT_COLOR'; payload: string };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: PocketVibeState, action: PVAction): PocketVibeState {
  switch (action.type) {
    case 'HYDRATE': {
      const { creations, activeCreationId } = action.payload;
      const validActiveId = activeCreationId && creations.some(c => c.id === activeCreationId)
        ? activeCreationId
        : null;
      return {
        ...state,
        creations,
        activeCreationId: validActiveId,
        view: validActiveId ? 'creation' : 'home',
      };
    }

    case 'SET_VIEW':
      return { ...state, view: action.payload };

    case 'UPSERT_CREATION': {
      const updated = upsertCreation(state.creations, action.payload);
      return { ...state, creations: updated };
    }

    case 'DELETE_CREATION': {
      const updated = deleteCreationById(state.creations, action.payload);
      const newActiveId = state.activeCreationId === action.payload ? null : state.activeCreationId;
      return {
        ...state,
        creations: updated,
        activeCreationId: newActiveId,
        view: newActiveId ? state.view : (updated.length > 0 ? 'my-creations' : 'home'),
      };
    }

    case 'SET_ACTIVE_CREATION':
      return { ...state, activeCreationId: action.payload };

    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload };

    case 'SET_PROCESSING_STATUS':
      return { ...state, processingStatus: action.payload };

    case 'SET_PENDING_ACTION':
      return { ...state, pendingAction: action.payload };

    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };

    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };

    case 'UPDATE_CREATION_CONTENT': {
      const { id, content } = action.payload;
      const updated = state.creations.map(c =>
        c.id === id ? { ...c, content, updatedAt: Date.now() } : c,
      );
      return { ...state, creations: updated };
    }

    case 'RENAME_CREATION': {
      const { id, title } = action.payload;
      const updated = state.creations.map(c =>
        c.id === id ? { ...c, title: title.trim().slice(0, 100), updatedAt: Date.now() } : c,
      );
      return { ...state, creations: updated };
    }

    case 'SET_ACCENT_COLOR':
      return { ...state, accentColor: action.payload };

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePocketVibe() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Hydrate from localStorage on mount ──────────────────────────────────────
  useEffect(() => {
    const creations = loadCreations();
    const activeCreationId = loadActiveCreationId();
    dispatch({ type: 'HYDRATE', payload: { creations, activeCreationId } });
  }, []);

  // ── Persist creations whenever they change ───────────────────────────────────
  useEffect(() => {
    if (state.creations.length > 0 || loadCreations().length > 0) {
      saveCreations(state.creations);
    }
  }, [state.creations]);

  // ── Persist active creation id whenever it changes ───────────────────────────
  useEffect(() => {
    saveActiveCreationId(state.activeCreationId);
  }, [state.activeCreationId]);

  // ── Derived helpers ──────────────────────────────────────────────────────────

  const activeCreation: Creation | null =
    state.activeCreationId
      ? (state.creations.find(c => c.id === state.activeCreationId) ?? null)
      : null;

  // ── Navigation ───────────────────────────────────────────────────────────────

  const openCreation = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_CREATION', payload: id });
    dispatch({ type: 'SET_VIEW', payload: 'creation' });
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  const goHome = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'home' });
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  const goToMyCreations = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'my-creations' });
  }, []);

  // ── Core generation ───────────────────────────────────────────────────────────

  const _runGeneration = useCallback(async (
    req: GenerateRequest,
    existingCreationId?: string,
  ) => {
    dispatch({ type: 'SET_GENERATING', payload: true });
    dispatch({ type: 'SET_PROCESSING_STATUS', payload: 'Understanding what you want to make...' });

    dispatch({
      type: 'ADD_MESSAGE',
      payload: { id: `u-${Date.now()}`, role: 'user', text: req.userRequest },
    });

    const creationId = existingCreationId ?? `c-${Date.now()}`;
    const now = Date.now();

    if (!existingCreationId) {
      const placeholder: Creation = {
        id: creationId,
        title: 'Making something for you...',
        creationType: 'checklist',
        description: '',
        summary: '',
        originalRequest: req.userRequest,
        status: 'generating',
        version: 1,
        createdAt: now,
        updatedAt: now,
        content: { type: 'checklist', sections: [] },
      };
      dispatch({ type: 'UPSERT_CREATION', payload: placeholder });
      dispatch({ type: 'SET_ACTIVE_CREATION', payload: creationId });
      dispatch({ type: 'SET_VIEW', payload: 'creation' });
    } else {
      const existing = stateRef.current.creations.find(c => c.id === existingCreationId);
      if (existing) {
        dispatch({
          type: 'UPSERT_CREATION',
          payload: { ...existing, status: 'generating', updatedAt: Date.now() },
        });
      }
    }

    try {
      const res = await generateCreation(req, (status) => {
        dispatch({ type: 'SET_PROCESSING_STATUS', payload: status });
      });

      const existing = stateRef.current.creations.find(c => c.id === creationId);
      const newVersion = req.mode === 'new' ? 1 : (existing?.version ?? 1) + 1;
      const updatedAt = Date.now();

      const finishedCreation: Creation = {
        id: creationId,
        title: res.title,
        creationType: res.creationType,
        description: res.description,
        summary: res.summary,
        originalRequest: req.mode === 'new' ? req.userRequest : (existing?.originalRequest ?? req.userRequest),
        status: 'ready',
        version: Math.max(1, newVersion),
        createdAt: existing?.createdAt ?? updatedAt,
        updatedAt,
        content: res.content,
      };

      dispatch({ type: 'UPSERT_CREATION', payload: finishedCreation });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { id: `a-${Date.now()}`, role: 'assistant', text: res.summary },
      });

      const accentByType: Record<string, string> = {
        checklist: '#7c3aed',
        habit_tracker: '#f97316',
        budget_calculator: '#16a34a',
        savings_tracker: '#0ea5e9',
        landing_page: '#ec4899',
        event_planner: '#f43f5e',
        meal_planner: '#14b8a6',
        workout_tracker: '#ef4444',
        survey_form: '#8b5cf6',
        task_planner: '#6366f1',
        generative_html: '#7c3aed',
      };
      dispatch({ type: 'SET_ACCENT_COLOR', payload: accentByType[res.creationType] ?? '#7c3aed' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      const isConfig = err instanceof AIConfigError;
      const existing = stateRef.current.creations.find(c => c.id === creationId);

      if (isConfig) {
        const fallback = generateOfflineFallback(req.userRequest);
        const offlineCreation: Creation = {
          id: creationId,
          title: fallback.title,
          creationType: fallback.creationType,
          description: fallback.description,
          summary: `${fallback.summary} (Made offline - set up your AI key for better results.)`,
          originalRequest: req.userRequest,
          status: 'ready',
          version: 1,
          createdAt: existing?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          content: fallback.content,
        };
        dispatch({ type: 'UPSERT_CREATION', payload: offlineCreation });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: `${fallback.summary} (AI not connected - showing an example you can edit.)`,
          },
        });
      } else {
        if (existing) {
          dispatch({
            type: 'UPSERT_CREATION',
            payload: { ...existing, status: 'error', updatedAt: Date.now() },
          });
        }
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { id: `e-${Date.now()}`, role: 'assistant', text: `Sorry - ${message} Please try again.` },
        });
      }
    } finally {
      dispatch({ type: 'SET_GENERATING', payload: false });
      dispatch({ type: 'SET_PROCESSING_STATUS', payload: null });
    }
  }, []);

  // ── Public generation actions ─────────────────────────────────────────────────

  const startNewCreation = useCallback((userRequest: string) => {
    const current = stateRef.current.activeCreationId
      ? stateRef.current.creations.find(c => c.id === stateRef.current.activeCreationId)
      : null;

    if (stateRef.current.isGenerating) return;

    if (current && current.status === 'ready' && stateRef.current.view === 'creation') {
      dispatch({ type: 'SET_PENDING_ACTION', payload: { type: 'new-creation', request: userRequest } });
      return;
    }

    dispatch({ type: 'CLEAR_MESSAGES' });
    const locale = {
      date: new Date().toISOString().slice(0, 10),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    void _runGeneration({ userRequest, mode: 'new', locale });
  }, [_runGeneration]);

  const confirmNewCreation = useCallback(() => {
    const pending = stateRef.current.pendingAction;
    if (!pending || pending.type !== 'new-creation') return;
    dispatch({ type: 'SET_PENDING_ACTION', payload: null });
    dispatch({ type: 'CLEAR_MESSAGES' });
    const locale = {
      date: new Date().toISOString().slice(0, 10),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    void _runGeneration({ userRequest: pending.request, mode: 'new', locale });
  }, [_runGeneration]);

  const dismissPendingAction = useCallback(() => {
    dispatch({ type: 'SET_PENDING_ACTION', payload: null });
  }, []);

  const improveCreation = useCallback((userRequest: string, mode: GenerationMode = 'improve') => {
    const current = stateRef.current.activeCreationId
      ? stateRef.current.creations.find(c => c.id === stateRef.current.activeCreationId)
      : null;

    if (!current || stateRef.current.isGenerating) return;

    const locale = {
      date: new Date().toISOString().slice(0, 10),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    void _runGeneration(
      {
        userRequest,
        mode,
        currentCreation: {
          id: current.id,
          title: current.title,
          creationType: current.creationType,
          content: current.content,
          originalRequest: current.originalRequest,
          version: current.version,
        },
        locale,
      },
      current.id,
    );
  }, [_runGeneration]);

  // ── Creation management ───────────────────────────────────────────────────────

  const deleteCreation = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CREATION', payload: id });
  }, []);

  const renameCreation = useCallback((id: string, title: string) => {
    dispatch({ type: 'RENAME_CREATION', payload: { id, title } });
  }, []);

  const duplicateCreation = useCallback((id: string) => {
    const original = stateRef.current.creations.find(c => c.id === id);
    if (!original) return;
    const now = Date.now();
    const duplicate: Creation = {
      ...original,
      id: `c-${now}`,
      title: `${original.title} (copy)`,
      createdAt: now,
      updatedAt: now,
      version: 1,
      status: 'ready',
    };
    dispatch({ type: 'UPSERT_CREATION', payload: duplicate });
    dispatch({ type: 'SET_ACTIVE_CREATION', payload: duplicate.id });
    dispatch({ type: 'SET_VIEW', payload: 'creation' });
  }, []);

  const updateCreationContent = useCallback((id: string, content: CreationContent) => {
    dispatch({ type: 'UPDATE_CREATION_CONTENT', payload: { id, content } });
  }, []);

  return {
    state,
    dispatch,
    activeCreation,
    openCreation,
    goHome,
    goToMyCreations,
    startNewCreation,
    improveCreation,
    confirmNewCreation,
    dismissPendingAction,
    deleteCreation,
    renameCreation,
    duplicateCreation,
    updateCreationContent,
  };
}
