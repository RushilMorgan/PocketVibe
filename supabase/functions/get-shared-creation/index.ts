// Supabase Edge Function — get-shared-creation
// Loads a shared tool by slug and determines access mode from an optional token.
// Deploy: supabase functions deploy get-shared-creation

// @ts-nocheck
// deno-lint-ignore-file
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Protects against slug enumeration and content scraping.
const _rateCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120;  // reads per window (generous for real users)
const RATE_WINDOW = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = _rateCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    _rateCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

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
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(clientIp)) {
    return json({ error: 'Too many requests. Please wait a moment and try again.' }, 429);
  }

  const url = new URL(req.url);
  const shareSlug = url.searchParams.get('shareSlug');
  const token = url.searchParams.get('token');

  if (!shareSlug) return json({ error: 'shareSlug is required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: row, error } = await supabase
    .from('shared_creations')
    .select('*')
    .eq('share_slug', shareSlug)
    .maybeSingle();

  if (error || !row) return json({ error: 'Shared creation not found' }, 404);

  let accessMode: 'admin' | 'participant' | 'viewer' = 'viewer';
  let participantRef: string | undefined;

  // ── 1. JWT-based admin recognition (signed-in creator, no token needed) ──────
  const authHeader = req.headers.get('authorization') ?? '';
  const bearerJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (bearerJwt && row.owner_user_id) {
    try {
      const { data: { user } } = await supabase.auth.getUser(bearerJwt);
      if (user && user.id === row.owner_user_id) {
        accessMode = 'admin';
      }
    } catch { /* not a valid user JWT — fall through */ }
  }

  // ── 2. Token-based access (admin token in URL, or participant token) ──────────
  if (accessMode !== 'admin' && token) {
    const tokenHash = await sha256Hex(token);

    if (safeCompare(tokenHash, row.owner_token_hash)) {
      accessMode = 'admin';
    } else {
      // Check participant tokens
      const { data: participants } = await supabase
        .from('shared_participants')
        .select('*')
        .eq('shared_creation_id', row.id);

      if (participants) {
        for (const p of participants) {
          if (p.participant_token_hash && safeCompare(tokenHash, p.participant_token_hash)) {
            accessMode = 'participant';
            participantRef = p.participant_ref;
            break;
          }
        }
      }
    }
  }

  // If still viewer and the creation is private, deny access.
  if (accessMode === 'viewer' && !row.public_view) {
    return json({ error: 'This creation is private' }, 403);
  }

  return json({
    creation: {
      shareSlug: row.share_slug,
      title: row.title,
      creationType: row.creation_type,
      content: row.content,
      version: row.version,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    },
    accessMode,
    participantRef,
  });
};

Deno.serve(async (req: Request) => {
  const res = await handleRequest(req);
  const headers = new Headers(res.headers);
  if (headers.has('Access-Control-Allow-Origin')) {
    headers.set('Access-Control-Allow-Origin', resolveAllowedOrigin(req));
  }
  return new Response(res.body, { status: res.status, headers });
});
