/**
 * Pure state machine for the PocketVibe app shell — extracted from usePocketVibe
 * so it can be unit-tested in isolation (it drives the whole app: which view is
 * shown, the in-memory creation list, generation flags, chat messages).
 *
 * Persistence, AI calls, and navigation side-effects stay in the hook; this file
 * is intentionally side-effect-free apart from Date.now() timestamps.
 */
import type {
  PocketVibeState,
  AppView,
  Creation,
  CreationContent,
  PendingAction,
  ChatMessage,
} from '../types';
import { upsertCreation, deleteCreationById } from './creationStore';

export const INITIAL_STATE: PocketVibeState = {
  view: 'home',
  creations: [],
  activeCreationId: null,
  isGenerating: false,
  processingStatus: null,
  pendingAction: null,
  messages: [],
  accentColor: '#7c3aed',
};

export type PVAction =
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

export function pocketVibeReducer(state: PocketVibeState, action: PVAction): PocketVibeState {
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
