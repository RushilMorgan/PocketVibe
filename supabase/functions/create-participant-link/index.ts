// Supabase Edge Function — create-participant-link
// Creates a participant token linked to one participant in a shared creation.
// Deploy: supabase functions deploy create-participant-link

// @ts-nocheck
// deno-lint-ignore-file
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

async function sha256Hex(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ── CORS origin allowlist ─────────────────────────────────────────────────────
// Echo the caller's origin only when it's one of ours (site, Vercel previews,
// local dev). Anything else gets the primary domain, so foreign websites can't
// use visitors' browsers to call these functions.
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?heytoolie\.com$/i,
  /^https:\/\/[\w.-]+\.vercel\.app$/i,
  /^http:\/\/localhost(:\d+)?$/i,
];

function resolveAllowedOrigin(req: Request): string {
  const origin = req.headers.get('origin');
  return origin && ALLOWED_ORIGIN_PATTERNS.some(re => re.test(origin))
    ? origin
    : 'https://heytoolie.com';
}

const handleRequest = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: {
    shareSlug?: string;
    adminToken?: string;
    participantRef?: string;
    displayName?: string;
    emoji?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { shareSlug, adminToken, participantRef, displayName, emoji } = body;
  if (!shareSlug || !adminToken || !participantRef || !displayName) {
    return json({ error: 'shareSlug, adminToken, participantRef, and displayName are required' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: row, error } = await supabase
    .from('shared_creations')
    .select('id, owner_token_hash')
    .eq('share_slug', shareSlug)
    .maybeSingle();

  if (error || !row) return json({ error: 'Shared creation not found' }, 404);

  // Verify admin token
  const tokenHash = await sha256Hex(adminToken);
  if (!safeCompare(tokenHash, row.owner_token_hash)) {
    return json({ error: 'Invalid admin token' }, 403);
  }

  // Generate participant token
  const participantToken = crypto.randomUUID();
  const participantTokenHash = await sha256Hex(participantToken);

  // Upsert participant record (one token per participantRef per creation)
  const { error: upsertError } = await supabase
    .from('shared_participants')
    .upsert({
      shared_creation_id: row.id,
      participant_ref: participantRef,
      display_name: displayName,
      emoji: emoji ?? null,
      participant_token_hash: participantTokenHash,
    }, { onConflict: 'shared_creation_id,participant_ref' });

  if (upsertError) {
    console.error('[create-participant-link] DB error:', upsertError.message);
    return json({ error: 'Failed to create participant link' }, 500);
  }

  const origin = req.headers.get('origin') ?? 'https://heytoolie.com';
  const participantUrl = `${origin}/s/${shareSlug}?p=${participantToken}`;

  return json({ participantUrl, participantToken });
};

Deno.serve(async (req: Request) => {
  const res = await handleRequest(req);
  const headers = new Headers(res.headers);
  if (headers.has('Access-Control-Allow-Origin')) {
    headers.set('Access-Control-Allow-Origin', resolveAllowedOrigin(req));
  }
  return new Response(res.body, { status: res.status, headers });
});
