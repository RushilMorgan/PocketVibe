/**
 * Client-side service for Hey Toolie shared tool operations.
 * All calls go through Supabase Edge Functions; tokens are never stored server-side in raw form.
 */
import type {
  Creation,
  CreationContent,
  CreateSharedResult,
  SharedCreationResponse,
  ParticipantLinkResult,
} from '../types';
import { supabase } from '../lib/supabaseClient';

// ── Env helpers (read lazily so tests can stub before import side-effects) ────

function getSupabaseUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL as string | undefined;
}

function getSupabaseAnonKey(): string | undefined {
  return import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
}

// ── Admin token store (localStorage) ─────────────────────────────────────────

const ADMIN_TOKEN_KEY = 'pv_admin_tokens';

function loadAdminTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_TOKEN_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveAdminToken(shareSlug: string, token: string): void {
  const tokens = loadAdminTokens();
  tokens[shareSlug] = token;
  localStorage.setItem(ADMIN_TOKEN_KEY, JSON.stringify(tokens));
}

export function getStoredAdminToken(shareSlug: string): string | undefined {
  return loadAdminTokens()[shareSlug];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function edgeFunctionUrl(name: string): string {
  const url = getSupabaseUrl();
  if (!url) throw new Error('Supabase not configured');
  return `${url}/functions/v1/${name}`;
}

function authHeaders(): Record<string, string> {
  const key = getSupabaseAnonKey();
  if (!key) throw new Error('Supabase anon key not configured');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    apikey: key,
  };
}

/** Returns headers with the user's JWT when signed in (so the edge function can set owner_user_id). */
async function userAuthHeaders(): Promise<Record<string, string>> {
  const key = getSupabaseAnonKey();
  if (!key) throw new Error('Supabase anon key not configured');
  let bearerToken = key;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) bearerToken = data.session.access_token;
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearerToken}`,
    apikey: key,
  };
}

async function requireOk(res: Response): Promise<Response> {
  if (res.ok) return res;
  let msg = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) msg = body.error;
  } catch { /* ignore */ }
  throw new Error(msg);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Share a creation. Stores the admin token in localStorage for future edits.
 * Returns the slug, view URL, admin URL, and raw admin token.
 */
export async function createSharedCreation(creation: Creation): Promise<CreateSharedResult> {
  const res = await fetch(edgeFunctionUrl('create-shared-creation'), {
    method: 'POST',
    headers: await userAuthHeaders(),
    body: JSON.stringify({
      title: creation.title,
      creationType: creation.creationType,
      content: creation.content,
    }),
  });
  await requireOk(res);
  const result: CreateSharedResult = await res.json();
  saveAdminToken(result.shareSlug, result.adminToken);
  return result;
}

/**
 * Load a shared creation by slug.
 * Pass a token (admin or participant) to get elevated access.
 */
export async function getSharedCreation(
  shareSlug: string,
  token?: string,
): Promise<SharedCreationResponse> {
  const url = new URL(edgeFunctionUrl('get-shared-creation'));
  url.searchParams.set('shareSlug', shareSlug);
  if (token) url.searchParams.set('token', token);

  // Send the user's JWT so the edge function can recognise signed-in owners as admin.
  const res = await fetch(url.toString(), {
    headers: await userAuthHeaders(),
  });
  await requireOk(res);
  return res.json();
}

/**
 * Update shared creation content with an admin or participant token.
 * expectedVersion prevents overwriting concurrent changes (pass undefined to skip check).
 */
export async function updateSharedCreation(
  shareSlug: string,
  token: string,
  patch: CreationContent | Partial<CreationContent>,
  expectedVersion?: number,
): Promise<{ version: number; content: CreationContent }> {
  const res = await fetch(edgeFunctionUrl('update-shared-creation'), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ shareSlug, token, patch, expectedVersion }),
  });
  await requireOk(res);
  return res.json();
}

/**
 * Create a participant link for a specific participant in the creation.
 * Returns the participant URL and the raw token (should be sent to the participant, never logged).
 */
export async function createParticipantLink(
  shareSlug: string,
  adminToken: string,
  participantRef: string,
  displayName: string,
  emoji?: string,
): Promise<ParticipantLinkResult> {
  const res = await fetch(edgeFunctionUrl('create-participant-link'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ shareSlug, adminToken, participantRef, displayName, emoji }),
  });
  await requireOk(res);
  return res.json();
}

/** Returns true if the Supabase credentials are present in the environment. */
export function isShareAvailable(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/**
 * After sharing, call this when the user is signed in to associate their account
 * as the owner. Non-blocking; silently no-ops when Supabase is unavailable.
 * The DB function verifies the admin token hash server-side (SECURITY DEFINER).
 */
export async function claimCreation(shareSlug: string, adminToken: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('claim_creation', {
      p_share_slug: shareSlug,
      p_admin_token: adminToken,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

/**
 * Permanently delete a shared creation the signed-in user owns (removes it from
 * their My things list and deactivates its shared link). Relies on the
 * `owner_can_delete_own` RLS policy: the delete only affects rows where
 * owner_user_id = auth.uid(), so a user can never delete someone else's tool.
 * Returns true on success.
 */
export async function deleteOwnedCreation(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('shared_creations').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Apply a named action to a shared creation.
 * Admin and participant actions are validated server-side.
 * Returns the new version number and updated content.
 */
export async function applyCreationAction(
  shareSlug: string,
  token: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<{ version: number; content: CreationContent }> {
  const res = await fetch(edgeFunctionUrl('apply-creation-action'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ shareSlug, token, action, payload }),
  });
  await requireOk(res);
  return res.json();
}

