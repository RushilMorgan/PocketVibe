// Supabase Edge Function — sync-world-cup-results
// Fetches World Cup 2026 fixtures and teams from API-Football (api-football.com),
// upserts the canonical tables, and logs the result.
//
// Required secret: API_FOOTBALL_KEY
//   supabase secrets set API_FOOTBALL_KEY=<your_key>
//
// Deploy: supabase functions deploy sync-world-cup-results
//
// Invoked by Supabase Cron (see schema-world-cup.sql for SQL) or manually:
//   curl -X POST https://<project>.supabase.co/functions/v1/sync-world-cup-results \
//     -H "Authorization: Bearer <service_role_key>"

// @ts-nocheck
// deno-lint-ignore-file
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const API_BASE = 'https://v3.football.api-sports.io';
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;

// ── Local WC2026 verified team mapping ───────────────────────────────────────
// Used to enrich DB rows with pot and FIFA rank after API sync.
// Keys are lowercased team names matching API-Football response.

interface TeamMeta { pot: number; fifaRank: number }

const WC2026_TEAM_META: Record<string, TeamMeta> = {
  'argentina':       { pot: 1, fifaRank: 1  },
  'france':          { pot: 1, fifaRank: 2  },
  'spain':           { pot: 1, fifaRank: 3  },
  'england':         { pot: 1, fifaRank: 4  },
  'brazil':          { pot: 1, fifaRank: 5  },
  'portugal':        { pot: 1, fifaRank: 6  },
  'netherlands':     { pot: 1, fifaRank: 7  },
  'germany':         { pot: 1, fifaRank: 10 },
  'belgium':         { pot: 1, fifaRank: 12 },
  'usa':             { pot: 1, fifaRank: 13 },
  'mexico':          { pot: 1, fifaRank: 16 },
  'canada':          { pot: 1, fifaRank: 48 },
  'croatia':         { pot: 2, fifaRank: 9  },
  'morocco':         { pot: 2, fifaRank: 14 },
  'japan':           { pot: 2, fifaRank: 18 },
  'switzerland':     { pot: 2, fifaRank: 19 },
  'uruguay':         { pot: 2, fifaRank: 20 },
  'denmark':         { pot: 2, fifaRank: 21 },
  'colombia':        { pot: 2, fifaRank: 22 },
  'south korea':     { pot: 2, fifaRank: 23 },
  'senegal':         { pot: 2, fifaRank: 24 },
  'austria':         { pot: 2, fifaRank: 25 },
  'australia':       { pot: 2, fifaRank: 26 },
  'ecuador':         { pot: 2, fifaRank: 28 },
  'italy':           { pot: 3, fifaRank: 8  },
  'ukraine':         { pot: 3, fifaRank: 22 },
  'turkey':          { pot: 3, fifaRank: 29 },
  'nigeria':         { pot: 3, fifaRank: 30 },
  'iran':            { pot: 3, fifaRank: 32 },
  'poland':          { pot: 3, fifaRank: 27 },
  'serbia':          { pot: 3, fifaRank: 33 },
  'egypt':           { pot: 3, fifaRank: 35 },
  'chile':           { pot: 3, fifaRank: 46 },
  'venezuela':       { pot: 3, fifaRank: 50 },
  "ivory coast":     { pot: 3, fifaRank: 57 },
  'saudi arabia':    { pot: 3, fifaRank: 56 },
  'czech republic':  { pot: 4, fifaRank: 37 },
  'scotland':        { pot: 4, fifaRank: 39 },
  'algeria':         { pot: 4, fifaRank: 52 },
  'tunisia':         { pot: 4, fifaRank: 54 },
  'ghana':           { pot: 4, fifaRank: 60 },
  'cameroon':        { pot: 4, fifaRank: 63 },
  'costa rica':      { pot: 4, fifaRank: 67 },
  'panama':          { pot: 4, fifaRank: 75 },
  'iraq':            { pot: 4, fifaRank: 80 },
  'honduras':        { pot: 4, fifaRank: 88 },
  'new zealand':     { pot: 4, fifaRank: 95 },
  'dr congo':        { pot: 4, fifaRank: 105 },
};

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── API-Football status → our status ─────────────────────────────────────────

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const LIVE_STATUSES     = new Set(['1H', 'HT', '2H', 'ET', 'P', 'BT', 'LIVE']);

function mapStatus(apiStatus: string): 'finished' | 'live' | 'scheduled' | 'postponed' | 'cancelled' {
  if (FINISHED_STATUSES.has(apiStatus)) return 'finished';
  if (LIVE_STATUSES.has(apiStatus))     return 'live';
  if (apiStatus === 'PST')              return 'postponed';
  if (apiStatus === 'CANC' || apiStatus === 'ABD') return 'cancelled';
  return 'scheduled';
}

// ── Round string → stage ──────────────────────────────────────────────────────

function mapRoundToStage(round: string): string {
  const r = round.toLowerCase();
  if (r.includes('group'))       return 'group';
  if (r.includes('32'))          return 'round_of_32';
  if (r.includes('16'))          return 'round_of_16';
  if (r.includes('quarter'))     return 'quarter_final';
  if (r.includes('semi'))        return 'semi_final';
  if (r.includes('3rd') || r.includes('third') || r.includes('place')) return 'semi_final';
  if (r.includes('final'))       return 'final';
  return 'group';
}

// Knock-out stage advancement: return the stage a WINNER progresses to,
// and what stage the LOSER ends their run at.
function knockoutProgression(stage: string): { winnerStage: string; loserStage: string } | null {
  switch (stage) {
    case 'round_of_32':  return { winnerStage: 'round_of_16',    loserStage: 'eliminated' };
    case 'round_of_16':  return { winnerStage: 'quarter_final',  loserStage: 'eliminated' };
    case 'quarter_final':return { winnerStage: 'semi_final',     loserStage: 'eliminated' };
    case 'semi_final':   return { winnerStage: 'final',          loserStage: 'eliminated' };
    case 'final':        return { winnerStage: 'winner',         loserStage: 'final' };
    default: return null; // group stage — handled separately
  }
}

// ── API-Football fetch helper ─────────────────────────────────────────────────

async function apiFetch(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'x-apisports-key': apiKey,
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  });
  if (!res.ok) throw new Error(`API-Football ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── Auth: require either the sync secret header or a service role bearer ──
  const syncSecret = Deno.env.get('WORLD_CUP_SYNC_SECRET');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const requestSecret = req.headers.get('x-sync-secret');
  const authHeader = req.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const hasValidSecret = syncSecret && requestSecret && safeCompare(requestSecret, syncSecret);
  const hasServiceRole = serviceRole && bearerToken && safeCompare(bearerToken, serviceRole);

  if (!hasValidSecret && !hasServiceRole) {
    return new Response(JSON.stringify({ error: 'Unauthorized — missing or invalid sync secret' }), {
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const startMs = Date.now();
  const apiKey = Deno.env.get('API_FOOTBALL_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API_FOOTBALL_KEY secret not set' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let teamsUpserted = 0;
  let matchesUpserted = 0;
  let teamsFromApi = 0;
  let fixturesFromApi = 0;
  let errorMessage: string | null = null;
  let syncStatus: 'success' | 'partial' | 'failed' = 'success';

  try {
    // ── 1. Sync teams ─────────────────────────────────────────────────────────
    const teamsData = await apiFetch(
      `/teams?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`,
      apiKey,
    );

    teamsFromApi = (teamsData.response ?? []).length;
    const teamRows = (teamsData.response ?? []).map((item: any) => {
      const meta = WC2026_TEAM_META[item.team.name?.toLowerCase() ?? ''];
      return {
        provider_team_id: item.team.id,
        name: item.team.name,
        code: item.team.code ?? null,
        country: item.team.country ?? null,
        flag_url: item.team.logo ?? null,
        pot: meta?.pot ?? null,
        fifa_rank: meta?.fifaRank ?? null,
        updated_at: new Date().toISOString(),
      };
    });

    if (teamRows.length > 0) {
      const { error: teamErr } = await supabase
        .from('world_cup_teams')
        .upsert(teamRows, {
          onConflict: 'provider_team_id',
          ignoreDuplicates: false,
        });
      if (teamErr) throw new Error(`Team upsert failed: ${teamErr.message}`);
      teamsUpserted = teamRows.length;
    }

    // ── 2. Sync fixtures (all statuses) ───────────────────────────────────────
    const fixturesData = await apiFetch(
      `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`,
      apiKey,
    );

    const fixtures: any[] = fixturesData.response ?? [];
    fixturesFromApi = fixtures.length;

    // Build match rows — skip manual overrides (is_manual_override = true in DB)
    const { data: existingOverrides } = await supabase
      .from('world_cup_matches')
      .select('provider_match_id')
      .eq('is_manual_override', true);
    const overrideIds = new Set((existingOverrides ?? []).map((r: any) => r.provider_match_id));

    const matchRows: any[] = [];
    for (const f of fixtures) {
      const provId: number = f.fixture.id;
      if (overrideIds.has(provId)) continue; // never overwrite manual corrections

      const status    = mapStatus(f.fixture.status.short);
      const round: string = f.league.round ?? '';
      const stage     = mapRoundToStage(round);
      const isLiveOrFinished = status === 'finished' || status === 'live';
      const scoreHome = isLiveOrFinished ? (f.goals?.home ?? null) : null;
      const scoreAway = isLiveOrFinished ? (f.goals?.away ?? null) : null;

      matchRows.push({
        provider_match_id: provId,
        home_team_id:      f.teams.home.id,
        away_team_id:      f.teams.away.id,
        score_home:        scoreHome,
        score_away:        scoreAway,
        match_date:        f.fixture.date ?? null,
        stage,
        round,
        status,
        venue:             f.fixture.venue?.name ?? null,
        is_manual_override: false,
        updated_at:        new Date().toISOString(),
      });
    }

    if (matchRows.length > 0) {
      const { error: matchErr } = await supabase
        .from('world_cup_matches')
        .upsert(matchRows, { onConflict: 'provider_match_id', ignoreDuplicates: false });
      if (matchErr) throw new Error(`Match upsert failed: ${matchErr.message}`);
      matchesUpserted = matchRows.length;
    }

    // ── 3. Update team stages from knockout results ───────────────────────────
    // For each finished knockout match, advance the winner and mark the loser.
    const knockoutUpdates = new Map<number, string>(); // provider_team_id → stage

    for (const f of fixtures) {
      const status = mapStatus(f.fixture.status.short);
      if (status !== 'finished') continue;

      const round: string = f.league.round ?? '';
      const stage = mapRoundToStage(round);
      const progression = knockoutProgression(stage);
      if (!progression) continue; // group stage — skip

      const homeId: number = f.teams.home.id;
      const awayId: number = f.teams.away.id;
      const scoreHome: number | null = f.goals?.home ?? null;
      const scoreAway: number | null = f.goals?.away ?? null;
      if (scoreHome === null || scoreAway === null) continue;

      // Penalty/ET winners use winner field if available
      const homeWon = f.teams.home.winner ?? (scoreHome > scoreAway);
      const awayWon = f.teams.away.winner ?? (scoreAway > scoreHome);

      if (homeWon) {
        const prev = knockoutUpdates.get(homeId);
        if (!prev || stageRank(progression.winnerStage) > stageRank(prev)) {
          knockoutUpdates.set(homeId, progression.winnerStage);
        }
        if (!knockoutUpdates.has(awayId)) {
          knockoutUpdates.set(awayId, progression.loserStage);
        }
      } else if (awayWon) {
        const prev = knockoutUpdates.get(awayId);
        if (!prev || stageRank(progression.winnerStage) > stageRank(prev)) {
          knockoutUpdates.set(awayId, progression.winnerStage);
        }
        if (!knockoutUpdates.has(homeId)) {
          knockoutUpdates.set(homeId, progression.loserStage);
        }
      }
    }

    // Batch update team stages
    for (const [provTeamId, stage] of knockoutUpdates) {
      await supabase
        .from('world_cup_teams')
        .update({ stage, updated_at: new Date().toISOString() })
        .eq('provider_team_id', provTeamId)
        .neq('stage', stage); // skip if already correct
    }

  } catch (err: any) {
    console.error('[sync-world-cup-results]', err?.message ?? err);
    errorMessage = err?.message ?? String(err);
    syncStatus = matchesUpserted > 0 || teamsUpserted > 0 ? 'partial' : 'failed';
  }

  const durationMs = Date.now() - startMs;

  await supabase.from('world_cup_sync_log').insert({
    status: syncStatus,
    matches_upserted: matchesUpserted,
    teams_upserted: teamsUpserted,
    error_message: errorMessage,
    provider: 'api-football',
    duration_ms: durationMs,
  });

  return new Response(
    JSON.stringify({ status: syncStatus, teamsUpserted, matchesUpserted, teamsFromApi, fixturesFromApi, durationMs, error: errorMessage }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});

// Return a numeric rank for a stage string (used to not downgrade a team's stage).
function stageRank(stage: string): number {
  const ORDER = ['active', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'winner', 'eliminated'];
  const i = ORDER.indexOf(stage);
  return i === -1 ? 0 : (stage === 'eliminated' ? -1 : i);
}
