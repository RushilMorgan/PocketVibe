// Supabase Edge Function — start-generation-job
// Runs a tool generation in the BACKGROUND so the browser can leave: inserts a
// job row, returns the jobId immediately, then (via EdgeRuntime.waitUntil) calls
// the existing pocketvibe-generate pipeline non-streaming, stores the result on
// the job, and sends a Web Push notification when it finishes.
//
// Generic by design: any tool can use it by passing its own `kind` + `request`
// (a GenerateRequest). Recipe extraction is the first caller.
//
// Deploy: supabase functions deploy start-generation-job
// Reuses existing secrets (PUSH_TRIGGER_SECRET) and auto-injected SUPABASE_* env.

// @ts-nocheck — Deno runtime file; VS Code TS errors here are false positives.
// deno-lint-ignore-file
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-pv-user-token',
};

// Background work ceiling. On the free plan the function's wall-clock is limited;
// we abort the pipeline call past this and mark the job errored so a stuck job
// never lingers as 'running' forever (the client also has its own timeout).
const PIPELINE_TIMEOUT_MS = 140_000;

// Per-kind notification copy. Add tools here as they adopt background jobs.
const NOTIFY_COPY: Record<string, { ok: { title: string; body: string }; fail: { title: string; body: string }; path: string }> = {
  recipe: {
    ok: { title: 'Your recipe is ready 🍳', body: 'Tap to open the recipe Toolie pulled out for you.' },
    fail: { title: "Couldn't finish that recipe", body: 'Something went wrong — tap to try again.' },
    path: '/tools/recipe-extractor',
  },
};
const DEFAULT_COPY = {
  ok: { title: 'Your tool is ready ✨', body: 'Tap to open what Toolie built.' },
  fail: { title: "Couldn't finish that", body: 'Something went wrong — tap to try again.' },
  path: '/',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let payload: {
    kind?: string;
    request?: Record<string, unknown>;
    clientToken?: string;
    notify?: { userId?: string | null; endpoint?: string | null };
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const kind = payload.kind;
  const request = payload.request;
  const clientToken = payload.clientToken;
  if (!kind || !request || !clientToken) return json({ error: 'kind_request_clientToken_required' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const notifyUserId = payload.notify?.userId ?? null;
  const notifyEndpoint = payload.notify?.endpoint ?? null;

  // Insert the job and return its id straight away — the browser is now free.
  const { data: jobRow, error: insertErr } = await admin
    .from('generation_jobs')
    .insert({ kind, user_id: notifyUserId, client_token: clientToken, status: 'running', input: request })
    .select('id')
    .single();
  if (insertErr || !jobRow) return json({ error: 'db_error', detail: insertErr?.message }, 500);

  const jobId = jobRow.id as string;

  // Forward the caller's identity so the pipeline attributes quota correctly:
  // x-pv-user-token (signed-in) else the real client IP for anonymous quota.
  const userToken = req.headers.get('x-pv-user-token');
  const clientIp = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const copy = NOTIFY_COPY[kind] ?? DEFAULT_COPY;

  const runJob = async () => {
    let status: 'done' | 'error' = 'error';
    let result: unknown = null;
    let errorText: string | null = null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PIPELINE_TIMEOUT_MS);
      const res = await fetch(`${supabaseUrl}/functions/v1/pocketvibe-generate`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          ...(userToken ? { 'x-pv-user-token': userToken } : {}),
          ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
        },
        // No stream: the pipeline returns a single final JSON response.
        body: JSON.stringify({ ...request, stream: false }),
      });
      clearTimeout(timer);

      if (res.ok) {
        result = await res.json();
        status = 'done';
      } else {
        let detail = '';
        try { detail = await res.text(); } catch { /* ignore */ }
        errorText = res.status === 429 ? 'quota' : `pipeline_${res.status}`;
        console.error('[start-generation-job] pipeline error', res.status, detail.slice(0, 300));
      }
    } catch (err: any) {
      errorText = err?.name === 'AbortError' ? 'timeout' : 'pipeline_exception';
      console.error('[start-generation-job] run error', err?.message ?? err);
    }

    await admin
      .from('generation_jobs')
      .update({ status, result, error: errorText, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    // Notify (best-effort). Signed-in users are targeted by user_id so a
    // subscription enabled any time before completion is found; anonymous users
    // are targeted by the endpoint captured at start.
    const pushSecret = Deno.env.get('PUSH_TRIGGER_SECRET');
    if (pushSecret && (notifyUserId || notifyEndpoint)) {
      const note = status === 'done' ? copy.ok : copy.fail;
      const target = notifyUserId ? { userId: notifyUserId } : { endpoint: notifyEndpoint };
      try {
        await fetch(`${supabaseUrl}/functions/v1/pocketvibe-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
            'x-push-secret': pushSecret,
          },
          body: JSON.stringify({
            ...target,
            title: note.title,
            body: note.body,
            url: `${copy.path}?job=${jobId}`,
            tag: `job-${jobId}`,
          }),
        });
      } catch (err) {
        console.error('[start-generation-job] push failed', err);
      }
    }
  };

  // Continue after the response returns.
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(runJob());
  } else {
    // Fallback for local/dev runtimes without waitUntil.
    void runJob();
  }

  return json({ jobId });
});
