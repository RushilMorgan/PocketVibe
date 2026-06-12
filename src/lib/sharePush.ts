import type { Creation } from '../types';
import {
  getStoredAdminToken,
  getSharedCreation,
  updateSharedCreation,
  updateOwnedCreationContent,
} from '../services/shareService';

/**
 * Push the owner's local content to their shared creation so viewers'
 * 30-second poll picks it up. Before this existed, editing a shared tool in
 * the main app only changed local state — a score entered by the pool admin
 * never reached the family's /s/ links.
 *
 * Paths, in order:
 *  1. Admin token stored on this device → update-shared-creation edge fn
 *     (skips the version check: the owner's latest edit wins).
 *  2. Signed-in owner without the token → read the row's current version,
 *     then an RLS-guarded optimistic update (null on conflict, never clobbers).
 */
export async function pushSharedContent(creation: Creation): Promise<boolean> {
  const slug = creation.shareSlug;
  if (!slug) return false;
  try {
    const token = getStoredAdminToken(slug);
    if (token) {
      await updateSharedCreation(slug, token, creation.content, undefined);
      return true;
    }
    const shared = await getSharedCreation(slug);
    const version = shared?.creation?.version;
    if (typeof version !== 'number') return false;
    const res = await updateOwnedCreationContent(slug, creation.content, version);
    return res !== null;
  } catch (err) {
    console.warn('[sharePush] Could not publish update to shared creation:', err);
    return false;
  }
}
