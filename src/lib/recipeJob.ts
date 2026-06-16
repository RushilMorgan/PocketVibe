/**
 * Client helpers for background recipe extraction.
 *
 * Instead of running the extraction in the browser tab (which dies the moment
 * you navigate away or the OS suspends the tab), we hand it to a server-side
 * job: start it, stash the handle in localStorage, then poll for the result —
 * which survives leaving and coming back, and triggers a push when done.
 *
 * Recipe-specific today, but the server side (start-/get-generation-job) is
 * generic, so other tools can grow their own thin client like this later.
 */
import { supabase } from './supabaseClient';
import { buildRecipePrompt } from './recipePrompt';
import { getAnalyticsDistinctId, type RecipeExtractionSource } from './analytics';
import type { RecipeContent, GenerateRequest } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const PENDING_KEY = 'pv_pending_recipe_job_v1';

export interface RecipeExtractInput {
  youtubeUrl: string;
  manualText: string;
  servings?: number;
  dietary?: string;
}

export interface PendingRecipeJob {
  jobId: string;
  token: string;
  startedAt: number;
  /** Echoed back so the working UI can show what's being worked on. */
  label?: string;
  /** How the extraction was kicked off — carried through for analytics. */
  source?: RecipeExtractionSource;
}

// ── localStorage handoff ────────────────────────────────────────────────────
export function loadPendingRecipeJob(): PendingRecipeJob | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingRecipeJob) : null;
  } catch {
    return null;
  }
}
export function savePendingRecipeJob(job: PendingRecipeJob): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(job)); } catch { /* quota */ }
}
export function clearPendingRecipeJob(): void {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

function buildRecipeRequest(input: RecipeExtractInput): GenerateRequest {
  const locale = {
    date: new Date().toISOString().slice(0, 10),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  return { userRequest: buildRecipePrompt(input), mode: 'new', locale, forcedType: 'recipe' };
}

/**
 * Kick off a background extraction. Returns the job handle (also persisted), or
 * null if the backend isn't configured / the start call failed.
 */
export async function startRecipeJob(
  input: RecipeExtractInput,
  opts: { userId?: string | null; notifyEndpoint?: string | null; source?: RecipeExtractionSource } = {},
): Promise<PendingRecipeJob | null> {
  if (!SUPABASE_URL || !ANON) return null;
  const token = crypto.randomUUID();
  const request = buildRecipeRequest(input);

  // Forward the session token so the pipeline attributes quota to the user.
  const userToken = (await supabase?.auth.getSession())?.data.session?.access_token;
  // Pass our PostHog distinct id + source so the server-side completed/failed
  // events attribute to the same person and keep the funnel intact.
  const distinctId = getAnalyticsDistinctId();

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/start-generation-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
        ...(userToken ? { 'x-pv-user-token': userToken } : {}),
      },
      body: JSON.stringify({
        kind: 'recipe',
        request,
        clientToken: token,
        notify: { userId: opts.userId ?? null, endpoint: opts.notifyEndpoint ?? null },
        analytics: { distinctId, source: opts.source ?? 'paste' },
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.jobId) return null;

  const job: PendingRecipeJob = {
    jobId: data.jobId,
    token,
    startedAt: Date.now(),
    label: input.youtubeUrl.trim() || 'your recipe',
    source: opts.source ?? 'paste',
  };
  savePendingRecipeJob(job);
  return job;
}

export interface RecipeJobState {
  status: 'running' | 'done' | 'error';
  recipe?: RecipeContent | null;
  error?: string | null;
}

/** Poll one job. Returns null on a transient fetch failure (caller retries). */
export async function getRecipeJob(jobId: string, token: string): Promise<RecipeJobState | null> {
  if (!SUPABASE_URL || !ANON) return null;
  let res: Response;
  try {
    res = await fetch(
      `${SUPABASE_URL}/functions/v1/get-generation-job?id=${encodeURIComponent(jobId)}&token=${encodeURIComponent(token)}`,
      { headers: { Authorization: `Bearer ${ANON}`, apikey: ANON } },
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.status) return null;

  // The job's `result` is a GenerateResponse: { creationType:'recipe', content }.
  const content =
    data.result?.creationType === 'recipe' && data.result?.content?.type === 'recipe'
      ? (data.result.content as RecipeContent)
      : null;
  return { status: data.status, recipe: content, error: data.error ?? null };
}
