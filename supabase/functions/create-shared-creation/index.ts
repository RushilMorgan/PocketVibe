// Supabase Edge Function — create-shared-creation
// Creates a new shared tool record and returns the slug + tokens.
// Deploy: supabase functions deploy create-shared-creation

// @ts-nocheck
// deno-lint-ignore-file
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const SLUG_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // unambiguous chars

function generateSlug(len = 8): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => SLUG_CHARS[b % SLUG_CHARS.length]).join('');
}

async function sha256Hex(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: { title?: string; creationType?: string; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { title, creationType, content } = body;
  if (!title || !creationType || !content) {
    return json({ error: 'title, creationType, and content are required' }, 400);
  }

  const SUPPORTED_TYPES = [
    'checklist', 'habit_tracker', 'budget_calculator', 'savings_tracker',
    'landing_page', 'event_planner', 'meal_planner', 'workout_tracker',
    'price_calculator', 'task_planner', 'tournament_pool_tracker',
    'idea_thinking_board', 'recipe',
  ];
  if (!SUPPORTED_TYPES.includes(creationType)) {
    return json({ error: `Unsupported creationType: ${creationType}` }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Resolve calling user from JWT (if present) so we can set owner_user_id.
  let ownerUserId: string | null = null;
  const authHeader = req.headers.get('authorization') ?? '';
  const bearerJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (bearerJwt) {
    const { data: { user } } = await supabase.auth.getUser(bearerJwt);
    if (user) ownerUserId = user.id;
  }

  // Generate unique slug (retry on collision — very unlikely)
  let shareSlug = generateSlug();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await supabase
      .from('shared_creations')
      .select('id')
      .eq('share_slug', shareSlug)
      .maybeSingle();
    if (!data) break;
    shareSlug = generateSlug();
  }

  const PUBLIC_VIEW_BY_DEFAULT = new Set([
    'tournament_pool_tracker', // World Cup Pool is public-viewable by default
    'workout_tracker',         // Partner Challenge leaderboard is public-viewable by default
  ]);
  const publicView = PUBLIC_VIEW_BY_DEFAULT.has(creationType as string);

  const adminToken = crypto.randomUUID();
  const ownerTokenHash = await sha256Hex(adminToken);

  const { error } = await supabase.from('shared_creations').insert({
    share_slug: shareSlug,
    title: String(title).slice(0, 200),
    creation_type: creationType,
    content,
    owner_token_hash: ownerTokenHash,
    public_view: publicView,
    version: 1,
    owner_user_id: ownerUserId,
    created_by_anonymous: !ownerUserId,
  });

  if (error) {
    console.error('[create-shared-creation] DB error:', error.message);
    return json({ error: 'Failed to save shared creation' }, 500);
  }

  const origin = req.headers.get('origin') ?? 'https://heytoolie.com';
  const viewUrl = `${origin}/s/${shareSlug}`;
  const adminUrl = `${origin}/s/${shareSlug}?admin=${adminToken}`;

  // Return publicView in result so client knows if view link is active
  const { data: row } = await supabase
    .from('shared_creations')
    .select('id')
    .eq('share_slug', shareSlug)
    .single();

  if (row) {
    await supabase.from('shared_creation_events').insert({
      shared_creation_id: row.id,
      actor_type: 'admin',
      actor_ref: 'admin',
      event_type: 'create',
      payload: { creationType },
    });
  }

  return json({ shareSlug, viewUrl, adminUrl, adminToken, publicView });
});
