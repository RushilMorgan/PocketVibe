// Supabase Edge Function — update-shared-creation
// Applies a patch to a shared tool. Admin can update anything.
// Participant can only apply allowed actions for their creation type.
// Deploy: supabase functions deploy update-shared-creation

// @ts-nocheck
// deno-lint-ignore-file
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
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

/**
 * Validate that a participant update is allowed.
 * - workout_tracker participants can only modify the logs array.
 *   All new log entries must have participantId === participantRef.
 * - tournament_pool_tracker participants can modify their own participant
 *   record (name/emoji) before the draw is locked.
 */
function validateParticipantPatch(
  creationType: string,
  participantRef: string,
  existingContent: Record<string, unknown>,
  patch: Record<string, unknown>,
): { ok: boolean; reason?: string } {
  if (creationType === 'workout_tracker') {
    const allowedKeys = new Set(['logs']);
    for (const key of Object.keys(patch)) {
      if (!allowedKeys.has(key)) {
        return { ok: false, reason: `Participants cannot change '${key}'` };
      }
    }
    if (patch.logs !== undefined) {
      const existingLogs = (existingContent.logs as Array<{ id: string; participantId: string }>) ?? [];
      const newLogs = patch.logs as Array<{ id: string; participantId: string }>;
      const existingIds = new Set(existingLogs.map(l => l.id));
      for (const log of newLogs) {
        if (!existingIds.has(log.id)) {
          // New log — must belong to this participant
          if (log.participantId !== participantRef) {
            return { ok: false, reason: 'You can only log your own activity' };
          }
        }
      }
    }
    return { ok: true };
  }

  if (creationType === 'tournament_pool_tracker') {
    const drawLocked = Boolean(existingContent.drawLocked);
    const allowedKeys = drawLocked ? new Set<string>() : new Set(['participants']);
    for (const key of Object.keys(patch)) {
      if (!allowedKeys.has(key)) {
        return { ok: false, reason: drawLocked ? 'Draw is locked — no edits allowed for participants' : `Participants cannot change '${key}'` };
      }
    }
    if (patch.participants !== undefined) {
      const newParticipants = patch.participants as Array<{ id: string }>;
      // Only allow editing own participant record
      const existing = (existingContent.participants as Array<{ id: string }>) ?? [];
      for (const p of newParticipants) {
        const orig = existing.find(e => e.id === p.id);
        if (orig && p.id !== participantRef) {
          return { ok: false, reason: 'You can only edit your own participant record' };
        }
      }
    }
    return { ok: true };
  }

  return { ok: false, reason: 'Participant updates not supported for this creation type' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'PATCH') return json({ error: 'Method not allowed' }, 405);

  let body: {
    shareSlug?: string;
    token?: string;
    patch?: Record<string, unknown>;
    expectedVersion?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { shareSlug, token, patch, expectedVersion } = body;
  if (!shareSlug || !token || !patch) {
    return json({ error: 'shareSlug, token, and patch are required' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: row, error: fetchError } = await supabase
    .from('shared_creations')
    .select('*')
    .eq('share_slug', shareSlug)
    .maybeSingle();

  if (fetchError || !row) return json({ error: 'Shared creation not found' }, 404);

  // Version check (skip for participant-only log updates to reduce conflicts)
  if (expectedVersion !== undefined && row.version !== expectedVersion) {
    return json({
      error: 'Version conflict — someone else updated this tool. Please refresh and try again.',
      currentVersion: row.version,
    }, 409);
  }

  const tokenHash = await sha256Hex(token);
  let actorType: 'admin' | 'participant' = 'participant';
  let participantRef: string | undefined;

  // Check admin
  if (safeCompare(tokenHash, row.owner_token_hash)) {
    actorType = 'admin';
  } else {
    // Check participant
    const { data: participants } = await supabase
      .from('shared_participants')
      .select('*')
      .eq('shared_creation_id', row.id);

    if (participants) {
      for (const p of participants) {
        if (p.participant_token_hash && safeCompare(tokenHash, p.participant_token_hash)) {
          actorType = 'participant';
          participantRef = p.participant_ref;
          break;
        }
      }
    }

    if (!participantRef) return json({ error: 'Invalid token' }, 403);

    // Participants must use apply-creation-action, not full patch updates.
    return json({
      error: 'Participants must use the apply-creation-action endpoint to make changes. Direct content patches are restricted to admins.',
    }, 403);
  }

  const newContent = { ...(row.content as object), ...patch };
  const newVersion = row.version + 1;

  const { error: updateError } = await supabase
    .from('shared_creations')
    .update({ content: newContent, version: newVersion, updated_at: new Date().toISOString() })
    .eq('id', row.id);

  if (updateError) {
    console.error('[update-shared-creation] DB error:', updateError.message);
    return json({ error: 'Failed to update creation' }, 500);
  }

  // Log event
  await supabase.from('shared_creation_events').insert({
    shared_creation_id: row.id,
    actor_type: actorType,
    actor_ref: participantRef ?? 'admin',
    event_type: 'update',
    payload: { keys: Object.keys(patch) },
  });

  return json({ version: newVersion, content: newContent });
});
