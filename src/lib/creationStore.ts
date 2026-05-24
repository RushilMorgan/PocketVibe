/**
 * Local persistence for PocketVibe creations.
 * Uses localStorage with versioned keys so future schema changes can migrate safely.
 */
import type { Creation } from '../types';

const STORE_KEY = 'pv_creations_v1';
const ACTIVE_KEY = 'pv_active_id_v1';

export function loadCreations(): Creation[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Creation[];
  } catch {
    return [];
  }
}

export function saveCreations(creations: Creation[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(creations));
  } catch {
    // Silently handle storage quota errors
  }
}

export function loadActiveCreationId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveCreationId(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(ACTIVE_KEY);
    } else {
      localStorage.setItem(ACTIVE_KEY, id);
    }
  } catch {
    // Silently handle
  }
}

/** Insert or replace a creation by id. Newest first. */
export function upsertCreation(creations: Creation[], creation: Creation): Creation[] {
  const idx = creations.findIndex(c => c.id === creation.id);
  if (idx === -1) return [creation, ...creations];
  const next = [...creations];
  next[idx] = creation;
  return next;
}

export function deleteCreationById(creations: Creation[], id: string): Creation[] {
  return creations.filter(c => c.id !== id);
}
