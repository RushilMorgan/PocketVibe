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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

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
  if (!row.public_view) return json({ error: 'This creation is private' }, 403);

  let accessMode: 'admin' | 'participant' | 'viewer' = 'viewer';
  let participantRef: string | undefined;

  if (token) {
    const tokenHash = await sha256Hex(token);

    // Check admin
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
});
