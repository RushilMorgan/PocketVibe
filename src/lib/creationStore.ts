/**
 * Local persistence for Hey Toolie creations.
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
    // Migrate: filter out old generative_html creations that could show raw HTML
    // Migrate: convert legacy survey_form creations to checklist
    return (parsed as Creation[])
      .filter(c => (c.content?.type as string) !== 'generative_html')
      .map(c => {
        if ((c.content?.type as string) === 'survey_form' || (c.creationType as string) === 'survey_form') {
          return {
            ...c,
            creationType: 'checklist' as const,
            content: { type: 'checklist' as const, sections: [] },
          };
        }
        return c;
      });
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
