/**
 * Cloud backup for local creations (the "keep your tools safe" promise).
 *
 * Signed-in users get every local creation backed up to the `user_creations`
 * table (RLS: owner-only). On sign-in we pull the cloud copies and merge them
 * into the local store (newest updatedAt wins per creation), so tools survive
 * a lost phone, cleared browser data, or switching devices.
 *
 * Deletes are propagated immediately when the user deletes a creation while
 * signed in; pushes are upsert-only so one device can never wipe another
 * device's backups.
 */
import type { Creation } from '../types';
import { supabase } from './supabaseClient';

interface CloudCreationRow {
  creation_id: string;
  data: Creation;
  updated_at_ms: number;
}

/** Upsert all local creations to the signed-in user's cloud backup. */
export async function pushCreationsToCloud(userId: string, creations: Creation[]): Promise<boolean> {
  if (!supabase || creations.length === 0) return false;
  try {
    const rows = creations
      .filter(c => c.status === 'ready')
      .map(c => ({
        user_id: userId,
        creation_id: c.id,
        data: c,
        updated_at_ms: c.updatedAt,
      }));
    if (rows.length === 0) return false;
    const { error } = await supabase
      .from('user_creations')
      .upsert(rows, { onConflict: 'user_id,creation_id' });
    return !error;
  } catch {
    return false;
  }
}

/** Fetch the signed-in user's cloud backups (RLS scopes to their own rows). */
export async function pullCreationsFromCloud(userId: string): Promise<Creation[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('user_creations')
      .select('creation_id, data, updated_at_ms')
      .eq('user_id', userId);
    if (error || !data) return [];
    return (data as CloudCreationRow[])
      .map(r => r.data)
      .filter((c): c is Creation => Boolean(c && c.id && c.content));
  } catch {
    return [];
  }
}

/** Remove one creation from the cloud backup (called on local delete). */
export async function deleteCloudCreation(userId: string, creationId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from('user_creations')
      .delete()
      .eq('user_id', userId)
      .eq('creation_id', creationId);
  } catch { /* fire-and-forget */ }
}

/**
 * Merge cloud backups into the local list. Per creation id, the newer
 * updatedAt wins; cloud-only creations are added. Pure — safe to unit test.
 */
export function mergeCloudIntoLocal(local: Creation[], cloud: Creation[]): Creation[] {
  const byId = new Map<string, Creation>(local.map(c => [c.id, c]));
  for (const remote of cloud) {
    const mine = byId.get(remote.id);
    if (!mine || (remote.updatedAt ?? 0) > (mine.updatedAt ?? 0)) {
      byId.set(remote.id, remote);
    }
  }
  return Array.from(byId.values());
}
