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
import { getCreationVisibleSignature, getContentVisibleSignature } from '../lib/visibleSignature';
import { tryApplyLocalUpdate } from '../lib/localUpdater';
import { isEditRequestOnNonEditableType, isRendererAlreadyEditable, getEditableRedirectMessage } from '../lib/capabilityRegistry';
import { normalizeGenerateResponse } from '../lib/normalizeResponse';
import { containsHtmlLikeText } from '../lib/htmlGuard';
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
  | { type: 'TOGGLE_FAVORITE'; payload: string }
  | { type: 'SET_ACCENT_COLOR'; payload: string }
  | { type: 'SET_CREATION_SHARE_SLUG'; payload: { id: string; shareSlug: string } };

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

    case 'TOGGLE_FAVORITE': {
      const updated = state.creations.map(c =>
        c.id === action.payload ? { ...c, isFavorite: !c.isFavorite, updatedAt: Date.now() } : c,
      );
      return { ...state, creations: updated };
    }

    case 'SET_CREATION_SHARE_SLUG': {
      const { id, shareSlug } = action.payload;
      const updated = state.creations.map(c =>
        c.id === id ? { ...c, shareSlug, updatedAt: Date.now() } : c,
      );
      return { ...state, creations: updated };
    }

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

  /** Maps errors to short, safe, user-facing messages. Never exposes HTML or technical details. */
  function toUserSafeErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      const msg = err.message;
      // Never show HTML, JSON blobs, or long technical strings
      if (containsHtmlLikeText(msg) || msg.length > 200 || msg.trimStart().startsWith('{') || msg.trimStart().startsWith('[')) {
        return 'The AI service returned something unexpected. Please try again.';
      }
      return msg;
    }
    return 'Something went wrong. Please try again.';
  }

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
      let res = await generateCreation(req, (status) => {
        dispatch({ type: 'SET_PROCESSING_STATUS', payload: status });
      });

      // ── Normalize: reject generative_html, strip HTML from text fields ────
      const existing = stateRef.current.creations.find(c => c.id === creationId);
      const safeRes = normalizeGenerateResponse(res, req);
      if (!safeRes) {
        if (req.mode !== 'new' && existing) {
          // For improve/add: restore existing creation unchanged, show honest message
          dispatch({
            type: 'UPSERT_CREATION',
            payload: { ...existing, status: 'ready', updatedAt: existing.updatedAt },
          });
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: "I couldn't update that properly. Your tool is unchanged.",
            },
          });
          return;
        }
        // 'new' mode — use offline fallback silently
        res = generateOfflineFallback(req.userRequest);
      } else {
        res = safeRes;
      }

      // ── Trust: visible-change verification for improve/add ────────────────
      if (req.mode !== 'new' && existing) {
        // Task 5: Honor server-side changeReport — if the server's QA pass confirmed
        // no visible change, skip the client repair attempt and respond honestly.
        if (res.changeReport !== undefined && !res.changeReport.changed) {
          dispatch({
            type: 'UPSERT_CREATION',
            payload: { ...existing, status: 'ready', updatedAt: existing.updatedAt },
          });
          const unsupportedMsg =
            res.changeReport.unsupported.length > 0
              ? `I can't make that change yet: ${res.changeReport.unsupported[0]}`
              : "I tried, but that didn't actually change anything. I'll need to rebuild this part properly instead.";
          dispatch({
            type: 'ADD_MESSAGE',
            payload: { id: `a-${Date.now()}`, role: 'assistant', text: unsupportedMsg },
          });
          return; // finally block still runs
        }

        const oldSig = getCreationVisibleSignature(existing);
        const newSig = getContentVisibleSignature(res.content);

        if (oldSig === newSig) {
          // No visible change — attempt one repair call with an explicit note
          dispatch({ type: 'SET_PROCESSING_STATUS', payload: 'Double-checking the result…' });
          let repaired = false;

          try {
            const repairReq: GenerateRequest = {
              ...req,
              userRequest: `${req.userRequest}\n\n[Important: Your previous response returned content that looks identical to what already exists. You MUST make a real visible change that satisfies the user's request. Do not return the same habits/items/amounts as before.]`,
            };
            const repairedRes = await generateCreation(repairReq);
            const repairedSig = getContentVisibleSignature(repairedRes.content);
            if (repairedSig !== oldSig) {
              res = repairedRes;
              repaired = true;
            }
          } catch {
            // repair call failed — continue to honest failure below
          }

          if (!repaired) {
            // Restore to ready without change, do NOT increment version
            dispatch({
              type: 'UPSERT_CREATION',
              payload: { ...existing, status: 'ready', updatedAt: existing.updatedAt },
            });
            dispatch({
              type: 'ADD_MESSAGE',
              payload: {
                id: `a-${Date.now()}`,
                role: 'assistant',
                text: "I tried, but that didn't actually change the tracker. I'll need to rebuild this part properly instead.",
              },
            });
            return; // finally block still runs
          }
        }
      }
      // ── End trust verification ────────────────────────────────────────────

      const newVersion = req.mode === 'new' ? 1 : (existing?.version ?? 1) + 1;
      const updatedAt = Date.now();

      const finishedCreation: Creation = {
        id: creationId,
        title: res.title,
        creationType: res.creationType,
        description: res.description,
        // For improve/add, keep the original creation summary so the banner
        // continues to describe what the creation IS, not what the AI claimed to change.
        summary: req.mode === 'new' ? res.summary : (existing?.summary ?? res.summary),
        originalRequest: req.mode === 'new' ? req.userRequest : (existing?.originalRequest ?? req.userRequest),
        status: 'ready',
        version: Math.max(1, newVersion),
        createdAt: existing?.createdAt ?? updatedAt,
        updatedAt,
        content: res.content,
      };

      dispatch({ type: 'UPSERT_CREATION', payload: finishedCreation });

      // For new creations the AI summary is descriptive. For improve/add we
      // compose the message from the verified outcome — not from AI text.
      const assistantMessage =
        req.mode === 'new'
          ? res.summary
          : `Done — I updated your ${res.title.toLowerCase()}.`;
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { id: `a-${Date.now()}`, role: 'assistant', text: assistantMessage },
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
        price_calculator: '#8b5cf6',
        task_planner: '#6366f1',
        tournament_pool_tracker: '#f59e0b',
      };
      dispatch({ type: 'SET_ACCENT_COLOR', payload: accentByType[res.creationType] ?? '#7c3aed' });
    } catch (err) {
      const message = toUserSafeErrorMessage(err);
      const isConfig = err instanceof AIConfigError;
      const existing = stateRef.current.creations.find(c => c.id === creationId);

      if (isConfig) {
        if (req.mode !== 'new' && existing) {
          // Never overwrite an existing creation when AI is not configured.
          // Restore to ready and show an honest message.
          dispatch({
            type: 'UPSERT_CREATION',
            payload: { ...existing, status: 'ready', updatedAt: existing.updatedAt },
          });
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: "AI is not connected right now, but you can still edit this tool directly.",
            },
          });
        } else {
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
        }
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

    // ── Capability gate ───────────────────────────────────────────────────────
    // If the user is asking to DIRECTLY EDIT a type whose renderer already
    // supports editing, point them to the built-in controls instead of
    // calling the AI (which would return unchanged content and then fail).
    if (isRendererAlreadyEditable(userRequest, current.creationType)) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: getEditableRedirectMessage(current.creationType),
        },
      });
      return;
    }

    // If the renderer has no editing support at all and the user is asking for it,
    // respond honestly instead of pretending the AI can provide it.
    if (isEditRequestOnNonEditableType(userRequest, current.creationType)) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: "I can't make that editable yet in this version. I can still rebuild it as an editable tracker.",
        },
      });
      return;
    }
    // ── End capability gate ───────────────────────────────────────────────────
    // ── Local update shortcut ────────────────────────────────────────────────
    const localResult = tryApplyLocalUpdate(userRequest, current);
    if (localResult.handled && localResult.updatedContent) {
      dispatch({
        type: 'UPSERT_CREATION',
        payload: {
          ...current,
          content: localResult.updatedContent,
          version: current.version + 1,
          updatedAt: Date.now(),
          status: 'ready',
        },
      });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { id: `a-${Date.now()}`, role: 'assistant', text: localResult.message ?? 'Done.' },
      });
      return;
    }
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
      sourceTemplate: original.id,
      isFavorite: false,
    };
    dispatch({ type: 'UPSERT_CREATION', payload: duplicate });
    dispatch({ type: 'SET_ACTIVE_CREATION', payload: duplicate.id });
    dispatch({ type: 'SET_VIEW', payload: 'creation' });
  }, []);

  const updateCreationContent = useCallback((id: string, content: CreationContent) => {
    dispatch({ type: 'UPDATE_CREATION_CONTENT', payload: { id, content } });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_FAVORITE', payload: id });
  }, []);

  const setCreationShareSlug = useCallback((id: string, shareSlug: string) => {
    dispatch({ type: 'SET_CREATION_SHARE_SLUG', payload: { id, shareSlug } });
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
    toggleFavorite,
    setCreationShareSlug,
  };
}
