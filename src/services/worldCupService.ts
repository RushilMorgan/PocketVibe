/**
 * Client-side service for reading canonical World Cup 2026 data.
 * Reads from world_cup_teams and world_cup_matches via the Supabase PostgREST API.
 * Both tables have public read RLS policies (see schema-world-cup.sql).
 */
import type { WorldCupTeam, WorldCupMatch } from '../types';

const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// ── Row shapes from PostgREST (snake_case) ────────────────────────────────────

interface WcTeamRow {
  provider_team_id: number;
  name: string;
  code: string | null;
  flag_url: string | null;
  group_name: string | null;
  stage: string;
}

interface WcMatchRow {
  provider_match_id: number;
  home_team_id: number;
  away_team_id: number;
  score_home: number | null;
  score_away: number | null;
  match_date: string | null;
  stage: string | null;
  round: string | null;
  status: string;
  is_manual_override: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function restUrl(table: string, query: string): string {
  if (!SUPABASE_URL) throw new Error('Supabase not configured');
  return `${SUPABASE_URL}/rest/v1/${table}?${query}`;
}

function authHeaders(): Record<string, string> {
  if (!SUPABASE_ANON_KEY) throw new Error('Supabase anon key not configured');
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

function toTeam(row: WcTeamRow): WorldCupTeam {
  return {
    providerTeamId: row.provider_team_id,
    name: row.name,
    code:    row.code    ?? undefined,
    flagUrl: row.flag_url ?? undefined,
    group:   row.group_name ?? undefined,
    stage:   row.stage,
  };
}

function toMatch(row: WcMatchRow): WorldCupMatch {
  const s = row.status as WorldCupMatch['status'];
  const validStatuses: WorldCupMatch['status'][] = ['scheduled', 'live', 'finished', 'postponed', 'cancelled'];
  return {
    providerMatchId: row.provider_match_id,
    homeTeamId:      row.home_team_id,
    awayTeamId:      row.away_team_id,
    scoreHome:   row.score_home  ?? undefined,
    scoreAway:   row.score_away  ?? undefined,
    matchDate:   row.match_date  ?? undefined,
    stage:       row.stage       ?? undefined,
    round:       row.round       ?? undefined,
    status:      validStatuses.includes(s) ? s : 'scheduled',
    isManualOverride: row.is_manual_override,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface WorldCupData {
  teams: WorldCupTeam[];
  matches: WorldCupMatch[];
}

/**
 * Load all canonical World Cup 2026 teams and matches.
 * Returns empty arrays on error (callers must gracefully degrade).
 */
export async function getWorldCupData(): Promise<WorldCupData> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { teams: [], matches: [] };
  }
  try {
    const headers = authHeaders();
    const [teamsRes, matchesRes] = await Promise.all([
      fetch(restUrl('world_cup_teams', 'select=*&order=name'), { headers }),
      fetch(restUrl('world_cup_matches', 'select=*&order=match_date'), { headers }),
    ]);
    const teamsRows: WcTeamRow[]   = teamsRes.ok   ? await teamsRes.json()   : [];
    const matchRows: WcMatchRow[]  = matchesRes.ok  ? await matchesRes.json() : [];
    return {
      teams:   teamsRows.map(toTeam),
      matches: matchRows.map(toMatch),
    };
  } catch {
    return { teams: [], matches: [] };
  }
}

/**
 * Load only live and recently-finished matches (lighter query for polling).
 */
export async function getLiveWorldCupMatches(): Promise<WorldCupMatch[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  try {
    const headers = authHeaders();
    const res = await fetch(
      restUrl('world_cup_matches', 'select=*&status=in.(live,finished)&order=match_date.desc&limit=20'),
      { headers },
    );
    const rows: WcMatchRow[] = res.ok ? await res.json() : [];
    return rows.map(toMatch);
  } catch {
    return [];
  }
}

/** Returns true if the Supabase credentials are present (WC data can be fetched). */
export function isWorldCupDataAvailable(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
