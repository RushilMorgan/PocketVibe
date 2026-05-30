// Supabase Edge Function — apply-creation-action
// Applies a named, typed action to a shared creation.
// Admin actions: add_result, update_team_status, draw_all, lock_draw,
//                update_scoring_rule, approve_change_request, decline_change_request
// Participant actions: log_activity, edit_own_log, delete_own_log, create_change_request
// Deploy: supabase functions deploy apply-creation-action

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

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextParticipantIdx(participants: any[], teams: any[]): number {
  const counts = participants.map((p: any, i: number) => ({
    i,
    count: teams.filter((t: any) => t.assignedTo === p.id).length,
  }));
  return counts.reduce((min: any, cur: any) => (cur.count < min.count ? cur : min)).i;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Keyed by IP; resets each minute. Limits abuse of write endpoints.
const _rateCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;   // max actions per window
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

const VALID_ACTIVITIES = new Set(['walk', 'run', 'gym', 'other']);
const VALID_TEAM_STATUSES = new Set([
  'active', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'winner', 'eliminated',
]);
const VALID_SCORING_KEYS = new Set([
  'pointsPerWin', 'pointsPerDraw', 'knockoutBonus',
  'quarterFinalBonus', 'semiFinalBonus', 'finalBonus', 'winnerBonus',
]);

// ── Admin actions ─────────────────────────────────────────────────────────────

function applyAdminAction(
  action: string,
  payload: Record<string, unknown>,
  content: Record<string, unknown>,
): { ok: boolean; content?: Record<string, unknown>; reason?: string } {
  if (action === 'add_result') {
    const { teamAId, teamBId, scoreA, scoreB, date, stage, isManualOverride, providerMatchId } = payload;
    if (!teamAId || !teamBId || teamAId === teamBId) {
      return { ok: false, reason: 'teamAId and teamBId are required and must differ' };
    }
    if (scoreA === undefined || scoreB === undefined) {
      return { ok: false, reason: 'scoreA and scoreB are required' };
    }
    const match: any = {
      id: generateId('m'),
      teamAId,
      teamBId,
      scoreA: Number(scoreA),
      scoreB: Number(scoreB),
      date: date ?? new Date().toISOString().slice(0, 10),
      stage: stage || undefined,
    };
    if (isManualOverride) match.isManualOverride = true;
    if (providerMatchId != null) match.providerMatchId = Number(providerMatchId);
    const matches = [...((content.matches as any[]) ?? []), match];
    return { ok: true, content: { ...content, matches } };
  }

  if (action === 'update_team_status') {
    const { teamId, status } = payload;
    if (!teamId || !VALID_TEAM_STATUSES.has(status as string)) {
      return { ok: false, reason: `Invalid teamId or status: ${status}` };
    }
    const teams = ((content.teams as any[]) ?? []).map((t: any) =>
      t.id === teamId ? { ...t, status } : t,
    );
    return { ok: true, content: { ...content, teams } };
  }

  if (action === 'draw_all') {
    const participants = (content.participants as any[]) ?? [];
    const teams = (content.teams as any[]) ?? [];
    if (participants.length === 0) return { ok: false, reason: 'No participants to draw for' };
    const unassigned = shuffle(teams.filter((t: any) => !t.assignedTo));
    if (unassigned.length === 0) return { ok: false, reason: 'All teams are already assigned' };
    let pidx = nextParticipantIdx(participants, teams);
    const assignment = new Map<string, string>();
    for (const team of unassigned) {
      assignment.set(team.id, participants[pidx].id);
      pidx = (pidx + 1) % participants.length;
    }
    const newTeams = teams.map((t: any) =>
      assignment.has(t.id) ? { ...t, assignedTo: assignment.get(t.id) } : t,
    );
    return { ok: true, content: { ...content, teams: newTeams } };
  }

  if (action === 'lock_draw') {
    return { ok: true, content: { ...content, drawLocked: true } };
  }

  if (action === 'update_scoring_rule') {
    const { key, value } = payload;
    if (!key || !VALID_SCORING_KEYS.has(key as string)) {
      return { ok: false, reason: `Invalid scoring rule key: ${key}` };
    }
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0) {
      return { ok: false, reason: 'value must be a non-negative number' };
    }
    const scoringRules = { ...((content.scoringRules as Record<string, number>) ?? {}), [key as string]: numValue };
    return { ok: true, content: { ...content, scoringRules } };
  }

  if (action === 'approve_change_request') {
    const { requestId } = payload;
    const changeRequests = ((content.changeRequests as any[]) ?? []);
    const req = changeRequests.find((r: any) => r.id === requestId && r.status === 'pending');
    if (!req) return { ok: false, reason: 'Change request not found or already resolved' };

    let updatedContent = { ...content };

    // For structured requests, apply the embedded action first.
    if (req.actionType && req.actionType !== 'free_text' && req.payload) {
      const actionResult = applyAdminAction(req.actionType, req.payload, updatedContent);
      if (!actionResult.ok) {
        return { ok: false, reason: `Could not apply structured change: ${actionResult.reason}` };
      }
      updatedContent = actionResult.content!;
    }

    const newRequests = ((updatedContent.changeRequests as any[]) ?? []).map((r: any) =>
      r.id === requestId ? { ...r, status: 'approved', resolvedAt: Date.now() } : r,
    );
    return { ok: true, content: { ...updatedContent, changeRequests: newRequests } };
  }

  if (action === 'decline_change_request') {
    const { requestId } = payload;
    const changeRequests = ((content.changeRequests as any[]) ?? []);
    const req = changeRequests.find((r: any) => r.id === requestId && r.status === 'pending');
    if (!req) return { ok: false, reason: 'Change request not found or already resolved' };
    const newRequests = changeRequests.map((r: any) =>
      r.id === requestId ? { ...r, status: 'declined', resolvedAt: Date.now() } : r,
    );
    return { ok: true, content: { ...content, changeRequests: newRequests } };
  }

  if (action === 'update_auto_settings') {
    const { autoResultsEnabled, resultProvider, allowManualOverrides, requireAdminApprovalForSuggestedChanges } = payload;
    const VALID_PROVIDERS = new Set(['api-football', 'manual']);
    if (resultProvider !== undefined && !VALID_PROVIDERS.has(resultProvider as string)) {
      return { ok: false, reason: `Invalid resultProvider: ${resultProvider}` };
    }
    const current = (content.autoSettings as Record<string, unknown>) ?? {};
    const autoSettings = {
      autoResultsEnabled: autoResultsEnabled !== undefined ? Boolean(autoResultsEnabled) : (current.autoResultsEnabled ?? false),
      resultProvider: resultProvider ?? current.resultProvider ?? 'api-football',
      allowManualOverrides: allowManualOverrides !== undefined ? Boolean(allowManualOverrides) : (current.allowManualOverrides ?? true),
      requireAdminApprovalForSuggestedChanges: requireAdminApprovalForSuggestedChanges !== undefined
        ? Boolean(requireAdminApprovalForSuggestedChanges)
        : (current.requireAdminApprovalForSuggestedChanges ?? false),
    };
    return { ok: true, content: { ...content, autoSettings } };
  }

  if (action === 'link_pool_team') {
    // Associate a pool team with a canonical World Cup team ID.
    const { teamId, providerTeamId } = payload;
    if (!teamId) return { ok: false, reason: 'teamId is required' };
    const teams = ((content.teams as any[]) ?? []);
    const team = teams.find((t: any) => t.id === teamId);
    if (!team) return { ok: false, reason: `Team not found: ${teamId}` };
    const newTeams = teams.map((t: any) =>
      t.id === teamId
        ? { ...t, providerTeamId: providerTeamId != null ? Number(providerTeamId) : undefined }
        : t,
    );
    return { ok: true, content: { ...content, teams: newTeams } };
  }

  return { ok: false, reason: `Unknown admin action: ${action}` };
}

// ── Participant actions ───────────────────────────────────────────────────────

function applyParticipantAction(
  action: string,
  payload: Record<string, unknown>,
  participantRef: string,
  creationType: string,
  content: Record<string, unknown>,
): { ok: boolean; content?: Record<string, unknown>; reason?: string } {
  if (action === 'log_activity') {
    if (creationType !== 'workout_tracker') {
      return { ok: false, reason: 'log_activity is only valid for workout_tracker' };
    }
    const { participantId, date, activityType, duration, note } = payload;
    if (participantId !== participantRef) {
      return { ok: false, reason: 'You can only log your own activity' };
    }
    if (!activityType || !VALID_ACTIVITIES.has(activityType as string)) {
      return { ok: false, reason: `Invalid activityType: ${activityType}` };
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date as string)) {
      return { ok: false, reason: 'date must be in YYYY-MM-DD format' };
    }
    const newLog = {
      id: generateId('l'),
      participantId: participantRef,
      date,
      activityType,
      duration: duration || undefined,
      note: note || undefined,
    };
    const logs = [...((content.logs as any[]) ?? []), newLog];
    return { ok: true, content: { ...content, logs } };
  }

  if (action === 'edit_own_log') {
    if (creationType !== 'workout_tracker') {
      return { ok: false, reason: 'edit_own_log is only valid for workout_tracker' };
    }
    const { logId, date, activityType, duration, note } = payload;
    const logs = (content.logs as any[]) ?? [];
    const log = logs.find((l: any) => l.id === logId);
    if (!log) return { ok: false, reason: 'Log not found' };
    if (log.participantId !== participantRef) {
      return { ok: false, reason: 'You can only edit your own logs' };
    }
    if (activityType && !VALID_ACTIVITIES.has(activityType as string)) {
      return { ok: false, reason: `Invalid activityType: ${activityType}` };
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date as string)) {
      return { ok: false, reason: 'date must be in YYYY-MM-DD format' };
    }
    const newLogs = logs.map((l: any) =>
      l.id === logId
        ? {
            ...l,
            date: date ?? l.date,
            activityType: activityType ?? l.activityType,
            duration: duration !== undefined ? (duration || undefined) : l.duration,
            note: note !== undefined ? (note || undefined) : l.note,
          }
        : l,
    );
    return { ok: true, content: { ...content, logs: newLogs } };
  }

  if (action === 'delete_own_log') {
    if (creationType !== 'workout_tracker') {
      return { ok: false, reason: 'delete_own_log is only valid for workout_tracker' };
    }
    const { logId } = payload;
    const logs = (content.logs as any[]) ?? [];
    const log = logs.find((l: any) => l.id === logId);
    if (!log) return { ok: false, reason: 'Log not found' };
    if (log.participantId !== participantRef) {
      return { ok: false, reason: 'You can only delete your own logs' };
    }
    return { ok: true, content: { ...content, logs: logs.filter((l: any) => l.id !== logId) } };
  }

  if (action === 'create_change_request') {
    if (creationType !== 'tournament_pool_tracker') {
      return { ok: false, reason: 'create_change_request is only valid for tournament_pool_tracker' };
    }
    const { description, actionType, payload: reqPayload } = payload;
    if (!description || String(description).trim().length === 0) {
      return { ok: false, reason: 'description is required' };
    }
    const VALID_ACTION_TYPES = new Set(['free_text', 'add_result', 'edit_participant_name', 'update_team_status', 'correct_team_assignment']);
    const resolvedActionType = actionType && VALID_ACTION_TYPES.has(actionType as string) ? actionType : 'free_text';
    const participants = (content.participants as any[]) ?? [];
    const participant = participants.find((p: any) => p.id === participantRef);
    const changeRequest: any = {
      id: generateId('cr'),
      participantId: participantRef,
      participantName: participant?.name ?? 'Participant',
      description: String(description).trim().slice(0, 500),
      actionType: resolvedActionType,
      status: 'pending',
      createdAt: Date.now(),
    };
    // Attach structured payload for non-free_text requests
    if (resolvedActionType !== 'free_text' && reqPayload && typeof reqPayload === 'object') {
      changeRequest.payload = reqPayload;
    }
    const changeRequests = [...((content.changeRequests as any[]) ?? []), changeRequest];
    return { ok: true, content: { ...content, changeRequests } };
  }

  return { ok: false, reason: `Unknown participant action: ${action}` };
}

// ── Action sets ───────────────────────────────────────────────────────────────

const ADMIN_ACTIONS = new Set([
  'add_result', 'update_team_status', 'draw_all', 'lock_draw',
  'update_scoring_rule', 'approve_change_request', 'decline_change_request',
  'update_auto_settings', 'link_pool_team',
]);
const PARTICIPANT_ACTIONS = new Set([
  'log_activity', 'edit_own_log', 'delete_own_log', 'create_change_request',
]);

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(clientIp)) {
    return json({ error: 'Too many requests. Please wait a moment and try again.' }, 429);
  }

  let body: { shareSlug?: string; token?: string; action?: string; payload?: Record<string, unknown>; expectedVersion?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { shareSlug, token, action, payload = {} } = body;
  if (!shareSlug || !token || !action) {
    return json({ error: 'shareSlug, token, and action are required' }, 400);
  }
  if (!ADMIN_ACTIONS.has(action) && !PARTICIPANT_ACTIONS.has(action)) {
    return json({ error: `Unknown action: ${action}` }, 400);
  }
  // Reject oversized payloads (protects server memory; 64 KB is generous for any valid action)
  if (JSON.stringify(payload).length > 65_536) {
    return json({ error: 'Payload too large' }, 413);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Load the creation
  const { data: row, error: fetchError } = await supabase
    .from('shared_creations')
    .select('id, creation_type, content, version, owner_token_hash')
    .eq('share_slug', shareSlug)
    .maybeSingle();

  if (fetchError || !row) {
    return json({ error: 'Creation not found' }, 404);
  }

  // Determine access level
  const tokenHash = await sha256Hex(token);
  let accessMode: 'admin' | 'participant' | null = null;
  let participantRef: string | null = null;

  if (safeCompare(tokenHash, row.owner_token_hash)) {
    accessMode = 'admin';
  } else {
    const { data: participants } = await supabase
      .from('shared_participants')
      .select('participant_ref, participant_token_hash')
      .eq('shared_creation_id', row.id);
    if (participants) {
      for (const p of participants) {
        if (safeCompare(tokenHash, p.participant_token_hash)) {
          accessMode = 'participant';
          participantRef = p.participant_ref;
          break;
        }
      }
    }
  }

  if (!accessMode) {
    return json({ error: 'Invalid or expired token' }, 403);
  }

  // Enforce action permissions
  if (accessMode === 'participant' && ADMIN_ACTIONS.has(action)) {
    return json({ error: `Action '${action}' requires admin access` }, 403);
  }

  // ── Optimistic concurrency control ──────────────────────────────────────────
  // Append-only actions (log_activity, create_change_request) use a retry loop
  // so concurrent writers don't overwrite each other's data.
  // All other actions accept an optional expectedVersion from the caller and
  // fail fast on any version conflict.
  const APPEND_ONLY_ACTIONS = new Set(['log_activity', 'create_change_request']);
  const MAX_RETRIES = 3;

  let currentRow = row;
  let savedVersion = 0;
  let savedContent = {};

  if (APPEND_ONLY_ACTIONS.has(action)) {
    // Retry loop: re-read → apply → write with optimistic lock
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const { data: fresh, error: refreshError } = await supabase
          .from('shared_creations')
          .select('id, creation_type, content, version, owner_token_hash')
          .eq('share_slug', shareSlug)
          .maybeSingle();
        if (refreshError || !fresh) return json({ error: 'Creation not found on retry' }, 404);
        currentRow = fresh;
      }

      const currentContent = currentRow.content;
      const result =
        accessMode === 'admin'
          ? applyAdminAction(action, payload, currentContent)
          : applyParticipantAction(action, payload, participantRef, currentRow.creation_type, currentContent);

      if (!result.ok) return json({ error: result.reason ?? 'Action rejected' }, 403);

      const newVersion = currentRow.version + 1;
      const { data: updated, error: updateError } = await supabase
        .from('shared_creations')
        .update({ content: result.content, version: newVersion })
        .eq('id', currentRow.id)
        .eq('version', currentRow.version)  // optimistic lock
        .select('id');

      if (!updateError && updated && updated.length > 0) {
        savedVersion = newVersion;
        savedContent = result.content;
        break;
      }
      if (attempt === MAX_RETRIES - 1) {
        return json({ error: 'Too many concurrent modifications. Please try again.' }, 409);
      }
      // else loop — re-read fresh row on next iteration
    }
  } else {
    // Non-append action: honour optional expectedVersion from caller
    const expectedVersion = body.expectedVersion;
    if (expectedVersion !== undefined && expectedVersion !== row.version) {
      return json({
        error: 'Version conflict: this tool has been updated since you loaded it. Please refresh.',
      }, 409);
    }

    const currentContent = row.content;
    const result =
      accessMode === 'admin'
        ? applyAdminAction(action, payload, currentContent)
        : applyParticipantAction(action, payload, participantRef, row.creation_type, currentContent);

    if (!result.ok) return json({ error: result.reason ?? 'Action rejected' }, 403);

    const newVersion = row.version + 1;
    const { data: updated, error: updateError } = await supabase
      .from('shared_creations')
      .update({ content: result.content, version: newVersion })
      .eq('id', row.id)
      .eq('version', row.version)  // optimistic lock
      .select('id');

    if (updateError || !updated || updated.length === 0) {
      console.error('[apply-creation-action] Update failed:', updateError?.message ?? 'version conflict');
      return json({ error: 'Conflict: this tool was updated concurrently. Please refresh.' }, 409);
    }

    savedVersion = newVersion;
    savedContent = result.content;
  }

  // Log event
  await supabase.from('shared_creation_events').insert({
    shared_creation_id: currentRow.id,
    actor_type: accessMode,
    actor_ref: accessMode === 'admin' ? 'admin' : participantRef,
    event_type: action,
    payload: { ...payload, _action: action },
  });

  return json({ version: savedVersion, content: savedContent });
});
