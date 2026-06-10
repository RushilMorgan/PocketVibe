import { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import type {
  PocketVibeState,
  AppView,
  Creation,
  CreationContent,
  PendingAction,
  ChatMessage,
  GenerationMode,
  GenerateRequest,
  GenerationStageEvent,
  TournamentTeam,
  RecipeContent,
} from '../types';
import { generateCreation, generateOfflineFallback, chatWithCreation, AIConfigError, QuotaExceededError } from '../services/aiService';
import { formatQuotaMessage } from '../lib/quotaMessage';
import { buildIdeaBoardPrompt } from '../lib/ideaBoardPrompt';
import { buildRecipePrompt } from '../lib/recipePrompt';
import { getUsage, _resetUsageStore, type UsageKind, type UsageTier } from '../lib/usageStore';
import { getWorldCupData } from '../services/worldCupService';
import { WC2026_SCORING_RULES, resolveTeamSource } from '../lib/worldCupTeams';
import { getCreationVisibleSignature, getContentVisibleSignature } from '../lib/visibleSignature';
import { tryApplyLocalUpdate } from '../lib/localUpdater';
import { isEditRequestOnNonEditableType, isRendererAlreadyEditable, getEditableRedirectMessage } from '../lib/capabilityRegistry';
import { normalizeGenerateResponse } from '../lib/normalizeResponse';
import { containsHtmlLikeText } from '../lib/htmlGuard';
import { celebrate } from '../lib/celebrate';
import {
  loadCreations,
  saveCreations,
  loadActiveCreationId,
  saveActiveCreationId,
  upsertCreation,
  deleteCreationById,
} from '../lib/creationStore';
import {
  pushCreationsToCloud,
  pullCreationsFromCloud,
  deleteCloudCreation,
  mergeCloudIntoLocal,
} from '../lib/creationSync';
import {
  trackCreationStarted,
  trackCreationCompleted,
  trackCreationImproved,
  trackWorldCupPoolCreated,
  trackCreationDeleted,
} from '../lib/analytics';

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: PocketVibeState = {
  view: 'home',
  creations: [],
  activeCreationId: null,
  isGenerating: false,
  processingStatus: null,
  stageEvents: [],
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
  | { type: 'ADD_STAGE_EVENT'; payload: GenerationStageEvent }
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
      // Starting a new run clears the previous run's stage timeline
      return action.payload
        ? { ...state, isGenerating: true, stageEvents: [] }
        : { ...state, isGenerating: false };

    case 'SET_PROCESSING_STATUS':
      return { ...state, processingStatus: action.payload };

    case 'ADD_STAGE_EVENT':
      return { ...state, stageEvents: [...state.stageEvents, action.payload] };

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

export function usePocketVibe(userId?: string) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Keep a ref so callbacks can read the latest userId without re-creating.
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // ── Daily-limit notice ──────────────────────────────────────────────────────
  // A visible, app-level signal when the user hits their daily limit — so a
  // blocked generation never silently dumps them home with the message buried in
  // the chat thread.
  const [quotaNotice, setQuotaNotice] = useState<{ kind: UsageKind; tier: UsageTier; resetsAt: string } | null>(null);
  const dismissQuotaNotice = useCallback(() => setQuotaNotice(null), []);

  // When the signed-in identity changes (sign in / sign out), the cached usage
  // belongs to the OLD identity and would wrongly block the new one. Reset it.
  const prevUserIdRef = useRef(userId);
  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      _resetUsageStore();
      setQuotaNotice(null);
    }
  }, [userId]);

  /**
   * Proactive guard: if the client already knows this budget is spent, show the
   * notice and report blocked — so we don't attempt a doomed generation that
   * would flash a placeholder and bounce the user home.
   */
  const isBlockedByQuota = useCallback((kind: UsageKind): boolean => {
    const snap = getUsage()[kind];
    if (snap && snap.remaining <= 0) {
      setQuotaNotice({ kind, tier: snap.tier, resetsAt: snap.resetsAt });
      return true;
    }
    return false;
  }, []);

  // ── Hydrate from localStorage on mount ──────────────────────────────────────
  useEffect(() => {
    // Self-heal: a creation left in 'generating' status means a previous run was
    // interrupted (tab closed / reloaded mid-generation). That state can never
    // resume, so it would otherwise leave the user stuck on a perpetual loading
    // or broken screen. Flip it to 'error' so the retry path is available and a
    // new creation can always be started. Never deletes the user's content.
    let healed = false;
    const creations = loadCreations().map(c => {
      if (c.status === 'generating') {
        healed = true;
        return { ...c, status: 'error' as const };
      }
      return c;
    });
    if (healed) saveCreations(creations);
    const activeCreationId = loadActiveCreationId();
    dispatch({ type: 'HYDRATE', payload: { creations, activeCreationId } });
  }, []);

  // ── Persist creations whenever they change ───────────────────────────────────
  // Skip while state still holds the pristine INITIAL_STATE references: these
  // effects fire once before HYDRATE's dispatch is processed, and persisting
  // that empty pre-hydration state would overwrite real saved data (with
  // StrictMode's double effect pass, the second hydrate then reads the wiped
  // store and the user's creations are gone for good).
  useEffect(() => {
    if (state.creations === INITIAL_STATE.creations) return;
    saveCreations(state.creations);
  }, [state.creations]);

  // ── Persist active creation id whenever it changes ───────────────────────────
  const activeIdHydratedRef = useRef(false);
  useEffect(() => {
    // Same pre-hydration guard: the id is null until HYDRATE lands, and saving
    // that null would erase the stored pointer before it's read.
    if (!activeIdHydratedRef.current) {
      activeIdHydratedRef.current = state.creations !== INITIAL_STATE.creations
        || state.activeCreationId !== null;
      if (!activeIdHydratedRef.current) return;
    }
    saveActiveCreationId(state.activeCreationId);
  }, [state.activeCreationId, state.creations]);

  // ── Cloud backup (signed-in users) ───────────────────────────────────────────
  // On sign-in: pull cloud backups and merge them in (newest updatedAt wins per
  // creation) without touching the current view, then push the merged set.
  const syncedUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) { syncedUserRef.current = null; return; }
    if (syncedUserRef.current === userId) return;
    syncedUserRef.current = userId;
    let cancelled = false;
    (async () => {
      const cloud = await pullCreationsFromCloud(userId);
      if (cancelled) return;
      const local = stateRef.current.creations;
      const merged = mergeCloudIntoLocal(local, cloud);
      const localById = new Map(local.map(c => [c.id, c]));
      for (const c of merged) {
        // mergeCloudIntoLocal keeps the local object when local wins, so a
        // different reference means the cloud copy is newer (or new).
        if (localById.get(c.id) !== c) dispatch({ type: 'UPSERT_CREATION', payload: c });
      }
      void pushCreationsToCloud(userId, merged);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // While signed in, back up local changes shortly after they settle.
  useEffect(() => {
    if (!userId || state.creations.length === 0) return;
    const t = setTimeout(() => {
      void pushCreationsToCloud(userId, stateRef.current.creations);
    }, 2500);
    return () => clearTimeout(t);
  }, [state.creations, userId]);

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

  const goToMyProfile = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'my-profile' });
  }, []);

  /**
   * Call this immediately after signing out.
   * Strips creations that were made while signed in as `signedOutUserId`,
   * keeps anonymous ones (no ownerUserId), and resets the view to home.
   */
  const signOutReset = useCallback((signedOutUserId: string) => {
    const remaining = stateRef.current.creations.filter(
      c => !c.ownerUserId || c.ownerUserId !== signedOutUserId,
    );
    saveCreations(remaining);
    saveActiveCreationId(null);
    dispatch({ type: 'HYDRATE', payload: { creations: remaining, activeCreationId: null } });
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
      let res = await generateCreation(req, (status, stageEvent) => {
        dispatch({ type: 'SET_PROCESSING_STATUS', payload: status });
        if (stageEvent) dispatch({ type: 'ADD_STAGE_EVENT', payload: stageEvent });
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

      // ── Forced-type guard ─────────────────────────────────────────────────
      // Guided entry points (Recipe, Idea Board) lock the output type. If the
      // backend returns a different type — e.g. a newly added type whose edge
      // function support isn't deployed yet — don't save a mismatched creation.
      if (req.mode === 'new' && req.forcedType && res.creationType !== req.forcedType) {
        dispatch({ type: 'DELETE_CREATION', payload: creationId });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: 'This one is still finishing setup on our side — please try again in a few minutes.',
          },
        });
        return;
      }

      // Container types (cookbook) hold user data the AI must never replace with
      // a different tool type. If an improve/add comes back as another type,
      // keep the original untouched and say so honestly.
      if (req.mode !== 'new' && existing
          && existing.creationType === 'recipe_book'
          && res.creationType !== existing.creationType) {
        dispatch({
          type: 'UPSERT_CREATION',
          payload: { ...existing, status: 'ready', updatedAt: existing.updatedAt },
        });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: "I couldn't make that change to your cookbook. Your recipes are untouched — try the controls inside the cookbook instead.",
          },
        });
        return;
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
        // Preserve existing ownerUserId or tag with current user if signed in.
        ownerUserId: existing?.ownerUserId ?? userIdRef.current,
      };

      dispatch({ type: 'UPSERT_CREATION', payload: finishedCreation });
      trackCreationCompleted(finishedCreation.creationType, finishedCreation.version);

      // Celebrate the landing: a big moment for the very first tool ever, a
      // quiet burst for every new one after that.
      if (req.mode === 'new') {
        let firstEver = false;
        try {
          firstEver = !localStorage.getItem('pv_first_creation_celebrated_v1');
          if (firstEver) localStorage.setItem('pv_first_creation_celebrated_v1', '1');
        } catch { /* storage unavailable — small burst is fine */ }
        celebrate(firstEver
          ? { intensity: 'big', message: 'You made your first tool! 🎉' }
          : { intensity: 'small' });
      }

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
        recipe: '#e11d48',
        recipe_book: '#e11d48',
      };
      dispatch({ type: 'SET_ACCENT_COLOR', payload: accentByType[res.creationType] ?? '#7c3aed' });
    } catch (err) {
      const message = toUserSafeErrorMessage(err);
      const isConfig = err instanceof AIConfigError;
      const existing = stateRef.current.creations.find(c => c.id === creationId);

      if (err instanceof QuotaExceededError) {
        // Daily limit hit — never overwrite/lose existing content, and surface a
        // VISIBLE notice (not a buried chat message) so the user isn't dumped home
        // wondering what happened.
        if (req.mode !== 'new' && existing) {
          dispatch({
            type: 'UPSERT_CREATION',
            payload: { ...existing, status: 'ready', updatedAt: existing.updatedAt },
          });
        } else if (existing) {
          // A placeholder generating-creation was created — remove it so we don't
          // leave an empty card behind.
          dispatch({ type: 'DELETE_CREATION', payload: creationId });
        }
        setQuotaNotice({ kind: err.kind, tier: err.tier, resetsAt: err.resetsAt });
      } else if (isConfig) {
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

    if (isBlockedByQuota('generation')) return;

    trackCreationStarted('unknown', userRequest);
    dispatch({ type: 'CLEAR_MESSAGES' });
    const locale = {
      date: new Date().toISOString().slice(0, 10),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    void _runGeneration({ userRequest, mode: 'new', locale });
  }, [_runGeneration, isBlockedByQuota]);

  /**
   * Guided Idea Board creation. Takes the intake answers, composes a rich prompt,
   * and locks the output type so the result is always a full Idea Thinking Board
   * (never a generic fallback). Mirrors the one-tap feel of the other flagships.
   */
  const createIdeaBoard = useCallback((categoryLabel: string, idea: string, intentId = 'validate') => {
    if (stateRef.current.isGenerating) return;
    if (isBlockedByQuota('generation')) return;
    const userRequest = buildIdeaBoardPrompt(categoryLabel, idea, intentId);
    trackCreationStarted('idea_thinking_board', userRequest);
    dispatch({ type: 'CLEAR_MESSAGES' });
    const locale = {
      date: new Date().toISOString().slice(0, 10),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    void _runGeneration({ userRequest, mode: 'new', locale, forcedType: 'idea_thinking_board' });
  }, [_runGeneration, isBlockedByQuota]);

  // Build a personal Cookbook tool from the setup preferences (no AI — direct).
  const createRecipeBook = useCallback((prefs: {
    title?: string; dietary: string; servings?: number; units: 'metric' | 'imperial'; likes?: string; avoids?: string;
  }) => {
    if (stateRef.current.isGenerating) return;
    const now = Date.now();
    const creationId = `c-${now}`;
    const title = (prefs.title?.trim() || 'My Cookbook').slice(0, 100);
    trackCreationStarted('recipe_book', title);
    dispatch({ type: 'CLEAR_MESSAGES' });
    const creation: Creation = {
      id: creationId,
      title,
      creationType: 'recipe_book',
      description: '',
      summary: '',
      originalRequest: 'Recipe cookbook',
      status: 'ready',
      version: 1,
      createdAt: now,
      updatedAt: now,
      ownerUserId: userIdRef.current,
      content: {
        type: 'recipe_book',
        title,
        preferences: {
          dietary: prefs.dietary,
          servings: prefs.servings,
          units: prefs.units,
          likes: prefs.likes,
          avoids: prefs.avoids,
        },
        recipes: [],
      },
    };
    dispatch({ type: 'UPSERT_CREATION', payload: creation });
    dispatch({ type: 'SET_ACTIVE_CREATION', payload: creationId });
    dispatch({ type: 'SET_VIEW', payload: 'creation' });
    trackCreationCompleted('recipe_book', 1);
  }, []);

  // Extract a single recipe from a link/text (respecting cookbook preferences),
  // returned for the cookbook renderer to append. Reuses the deployed `recipe`
  // generation; quota-guarded; returns null on failure.
  const extractRecipe = useCallback(async (input: {
    youtubeUrl: string; manualText: string; servings?: number; dietary?: string;
  }): Promise<RecipeContent | null> => {
    if (isBlockedByQuota('generation')) return null;
    const locale = {
      date: new Date().toISOString().slice(0, 10),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const req: GenerateRequest = { userRequest: buildRecipePrompt(input), mode: 'new', locale, forcedType: 'recipe' };
    try {
      const res = await generateCreation(req);
      const safe = normalizeGenerateResponse(res, req) ?? res;
      if (safe.creationType !== 'recipe' || safe.content.type !== 'recipe') return null;
      return safe.content as RecipeContent;
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setQuotaNotice({ kind: err.kind, tier: err.tier, resetsAt: err.resetsAt });
      }
      return null;
    }
  }, [isBlockedByQuota]);

  // Chat about ONE recipe (inside a cookbook). Wraps the recipe as a `recipe`
  // creation so the AI gets that recipe's full context — independent of the
  // active cookbook. Returns an answer, or an updated recipe when the user asked
  // for a change (the renderer applies it via onChange).
  const chatAboutRecipe = useCallback(async (
    recipe: RecipeContent,
    message: string,
  ): Promise<{ answer?: string; updatedRecipe?: RecipeContent }> => {
    if (isBlockedByQuota('chat')) {
      return { answer: "You've reached today's chat limit — please try again later." };
    }
    const synthetic: Creation = {
      id: 'recipe-chat', title: recipe.title, creationType: 'recipe',
      description: '', summary: '', originalRequest: '', status: 'ready',
      version: 1, createdAt: Date.now(), updatedAt: Date.now(), content: recipe,
    };
    const locale = {
      date: new Date().toISOString().slice(0, 10),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    try {
      const result = await chatWithCreation(synthetic, message);
      if (result.type === 'answer') return { answer: result.text };
      // modify → rebuild this one recipe with the change applied
      const req: GenerateRequest = {
        userRequest: message,
        mode: 'improve',
        forcedType: 'recipe',
        currentCreation: {
          id: synthetic.id, title: recipe.title, creationType: 'recipe',
          content: recipe, originalRequest: '', version: 1,
        },
        locale,
      };
      const res = await generateCreation(req);
      const safe = normalizeGenerateResponse(res, req) ?? res;
      if (safe.creationType === 'recipe' && safe.content.type === 'recipe') {
        return { updatedRecipe: safe.content as RecipeContent, answer: 'Done — updated the recipe. 👍' };
      }
      return { answer: "I couldn't change that one — try rephrasing." };
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setQuotaNotice({ kind: err.kind, tier: err.tier, resetsAt: err.resetsAt });
        return { answer: "You've reached today's limit — please try again later." };
      }
      return { answer: 'Something went wrong. Please try again.' };
    }
  }, [isBlockedByQuota]);

  const confirmNewCreation = useCallback(() => {
    const pending = stateRef.current.pendingAction;
    if (!pending || pending.type !== 'new-creation') return;
    dispatch({ type: 'SET_PENDING_ACTION', payload: null });
    if (isBlockedByQuota('generation')) return;
    trackCreationStarted('unknown', pending.request);
    dispatch({ type: 'CLEAR_MESSAGES' });
    const locale = {
      date: new Date().toISOString().slice(0, 10),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    void _runGeneration({ userRequest: pending.request, mode: 'new', locale });
  }, [_runGeneration, isBlockedByQuota]);

  const dismissPendingAction = useCallback(() => {
    dispatch({ type: 'SET_PENDING_ACTION', payload: null });
  }, []);

  const improveCreation = useCallback((userRequest: string, mode: GenerationMode = 'improve') => {
    const current = stateRef.current.activeCreationId
      ? stateRef.current.creations.find(c => c.id === stateRef.current.activeCreationId)
      : null;

    if (!current || stateRef.current.isGenerating) return;

    if (isBlockedByQuota('generation')) return;

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
    trackCreationImproved(mode === 'add' ? 'add' : 'improve');
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
  }, [_runGeneration, isBlockedByQuota]);

  // ── Creation management ───────────────────────────────────────────────────────

  const deleteCreation = useCallback((id: string) => {
    const toDelete = stateRef.current.creations.find(c => c.id === id);
    if (toDelete) trackCreationDeleted(toDelete.creationType);
    dispatch({ type: 'DELETE_CREATION', payload: id });
    // Keep the cloud backup in step so deleted tools don't come back on sign-in.
    if (userIdRef.current) void deleteCloudCreation(userIdRef.current, id);
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
      ownerUserId: userIdRef.current,
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

  // ── One-click World Cup Pool creation ─────────────────────────────────────────

  const createWorldCupPool = useCallback(async () => {
    if (stateRef.current.isGenerating) return;

    trackWorldCupPoolCreated();
    dispatch({ type: 'CLEAR_MESSAGES' });
    dispatch({ type: 'SET_GENERATING', payload: true });
    dispatch({ type: 'SET_PROCESSING_STATUS', payload: 'Loading World Cup teams…' });

    let teams: TournamentTeam[];
    let teamsSource: 'official' | 'demo_fallback' | 'incomplete_canonical';
    let warningMessage: string | undefined;

    try {
      const { teams: wcTeams } = await getWorldCupData();
      const resolved = resolveTeamSource(wcTeams);
      teams = resolved.teams;
      teamsSource = resolved.teamsSource;
      warningMessage = resolved.warning;
    } catch {
      const resolved = resolveTeamSource([]);
      teams = resolved.teams;
      teamsSource = resolved.teamsSource;
    }

    const now = Date.now();
    const creationId = `c-${now}`;
    const creation: Creation = {
      id: creationId,
      title: 'World Cup 2026 Pool',
      creationType: 'tournament_pool_tracker',
      description: '',
      summary: teamsSource === 'official'
        ? `${teams.length} official teams across 4 pots, ready to draw.`
        : `${teams.length} teams across 4 pots (demo data).${warningMessage ? ' ' + warningMessage : ''}`,
      originalRequest: 'World Cup Pool',
      status: 'ready',
      version: 1,
      createdAt: now,
      updatedAt: now,
      ownerUserId: userIdRef.current,
      content: {
        type: 'tournament_pool_tracker',
        poolName: 'World Cup 2026 Pool',
        tournamentName: 'FIFA World Cup 2026',
        participants: [],
        teams,
        matches: [],
        drawLocked: false,
        scoringRules: WC2026_SCORING_RULES,
        teamsSource,
      },
    };

    dispatch({ type: 'UPSERT_CREATION', payload: creation });
    dispatch({ type: 'SET_ACTIVE_CREATION', payload: creationId });
    dispatch({ type: 'SET_VIEW', payload: 'creation' });
    dispatch({ type: 'SET_GENERATING', payload: false });
    dispatch({ type: 'SET_PROCESSING_STATUS', payload: null });
  }, []);

  // ── Chat fast path ────────────────────────────────────────────────────────────
  // Sends a single message with the creation's data as context.
  // If the AI decides the user wants to modify the tool, hands off to _runGeneration
  // directly (bypassing improveCreation's isGenerating guard, which would already
  // be true at that point).
  const chatMessage = useCallback(async (text: string) => {
    const current = stateRef.current.activeCreationId
      ? stateRef.current.creations.find(c => c.id === stateRef.current.activeCreationId)
      : null;

    if (!current || stateRef.current.isGenerating) return;

    dispatch({ type: 'SET_GENERATING', payload: true });
    dispatch({ type: 'SET_PROCESSING_STATUS', payload: 'Thinking…' });

    // Flag so the finally block knows not to clear isGenerating when we hand
    // off to _runGeneration (which will manage it from that point on).
    let handedOffToModify = false;

    try {
      const result = await chatWithCreation(current, text);

      if (result.type === 'modify') {
        handedOffToModify = true;
        // _runGeneration sets isGenerating: true itself and adds the user message,
        // so we stay in generating state with no gap.
        const locale = {
          date: new Date().toISOString().slice(0, 10),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        void _runGeneration(
          {
            userRequest: text,
            mode: 'improve',
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
        return;
      }

      // Q&A — add user message then assistant answer
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { id: `u-${Date.now()}`, role: 'user', text },
      });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { id: `a-${Date.now()}`, role: 'assistant', text: result.text },
      });
    } catch (err) {
      // Show the user's message even on failure so the thread makes sense
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { id: `u-${Date.now()}`, role: 'user', text },
      });
      if (err instanceof QuotaExceededError) {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: `q-${Date.now()}`,
            role: 'assistant',
            text: formatQuotaMessage({
              kind: err.kind,
              tier: err.tier,
              resetsAt: err.resetsAt,
              canSignIn: !userIdRef.current,
            }),
          },
        });
      } else {
        const message = toUserSafeErrorMessage(err);
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { id: `e-${Date.now()}`, role: 'assistant', text: `Sorry — ${message}` },
        });
      }
    } finally {
      if (!handedOffToModify) {
        dispatch({ type: 'SET_GENERATING', payload: false });
        dispatch({ type: 'SET_PROCESSING_STATUS', payload: null });
      }
      // If handedOffToModify, _runGeneration owns isGenerating from here.
    }
  }, [_runGeneration]);

  return {
    state,
    dispatch,
    activeCreation,
    openCreation,
    goHome,
    goToMyCreations,
    signOutReset,
    startNewCreation,
    improveCreation,
    chatMessage,
    confirmNewCreation,
    dismissPendingAction,
    deleteCreation,
    renameCreation,
    duplicateCreation,
    updateCreationContent,
    toggleFavorite,
    setCreationShareSlug,
    createWorldCupPool,
    createIdeaBoard,
    createRecipeBook,
    extractRecipe,
    chatAboutRecipe,
    quotaNotice,
    dismissQuotaNotice,
    goToMyProfile,
  };
}
