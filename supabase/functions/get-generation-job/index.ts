// Supabase Edge Function — get-generation-job
// Returns a background job's status + result by id + client_token. The token is
// the unguessable key that lets an anonymous owner read their own job (the
// browser stores it in localStorage when the job starts). Uses the service role
// so it works for anonymous jobs (which have no auth.uid()).
//
// Deploy: supabase functions deploy get-generation-job

// @ts-nocheck — Deno runtime file; VS Code TS errors here are false positives.
// deno-lint-ignore-file
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const token = url.searchParams.get('token');
  if (!id || !token) return json({ error: 'id_and_token_required' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await admin
    .from('generation_jobs')
    .select('kind, status, result, error, client_token')
    .eq('id', id)
    .maybeSingle();

  if (error) return json({ error: 'db_error' }, 500);
  if (!data) return json({ error: 'not_found' }, 404);
  if (data.client_token !== token) return json({ error: 'forbidden' }, 403);

  return json({ kind: data.kind, status: data.status, result: data.result, error: data.error });
});
