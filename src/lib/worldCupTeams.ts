/**
 * World Cup 2026 team data and helpers.
 * Used when creating a pool directly (bypassing AI generation).
 */
import type { TournamentTeam, TournamentScoringRules, WorldCupTeam } from '../types';

// ── Default scoring rules for WC pools ───────────────────────────────────────

export const WC2026_SCORING_RULES: TournamentScoringRules = {
  pointsPerWin: 3,
  pointsPerDraw: 1,
  knockoutBonus: 2,
  quarterFinalBonus: 4,
  semiFinalBonus: 6,
  finalBonus: 9,
  winnerBonus: 12,
};

// ── Hardcoded fallback team list (used when DB is empty or unavailable) ───────
// Based on FIFA World Cup 2026 qualification. 48 teams across 4 pots.
// Pot 1 = top-ranked / hosts; Pot 4 = lower-ranked qualifiers.

let _uid = 0;
function tid(): string {
  return `wct-${++_uid}`;
}

interface FallbackTeam {
  name: string;
  flagEmoji: string;
  pot: number;
}

const FALLBACK_LIST: FallbackTeam[] = [
  // ── Pot 1 (hosts + top FIFA-ranked) ─────────────────────────────────────
  { name: 'Argentina',   flagEmoji: '🇦🇷', pot: 1 },
  { name: 'France',      flagEmoji: '🇫🇷', pot: 1 },
  { name: 'Spain',       flagEmoji: '🇪🇸', pot: 1 },
  { name: 'England',     flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', pot: 1 },
  { name: 'Brazil',      flagEmoji: '🇧🇷', pot: 1 },
  { name: 'Portugal',    flagEmoji: '🇵🇹', pot: 1 },
  { name: 'Netherlands', flagEmoji: '🇳🇱', pot: 1 },
  { name: 'Germany',     flagEmoji: '🇩🇪', pot: 1 },
  { name: 'USA',         flagEmoji: '🇺🇸', pot: 1 },
  { name: 'Mexico',      flagEmoji: '🇲🇽', pot: 1 },
  { name: 'Canada',      flagEmoji: '🇨🇦', pot: 1 },
  { name: 'Belgium',     flagEmoji: '🇧🇪', pot: 1 },
  // ── Pot 2 ────────────────────────────────────────────────────────────────
  { name: 'Morocco',     flagEmoji: '🇲🇦', pot: 2 },
  { name: 'Japan',       flagEmoji: '🇯🇵', pot: 2 },
  { name: 'Croatia',     flagEmoji: '🇭🇷', pot: 2 },
  { name: 'Colombia',    flagEmoji: '🇨🇴', pot: 2 },
  { name: 'Uruguay',     flagEmoji: '🇺🇾', pot: 2 },
  { name: 'Switzerland', flagEmoji: '🇨🇭', pot: 2 },
  { name: 'Denmark',     flagEmoji: '🇩🇰', pot: 2 },
  { name: 'South Korea', flagEmoji: '🇰🇷', pot: 2 },
  { name: 'Austria',     flagEmoji: '🇦🇹', pot: 2 },
  { name: 'Senegal',     flagEmoji: '🇸🇳', pot: 2 },
  { name: 'Ecuador',     flagEmoji: '🇪🇨', pot: 2 },
  { name: 'Australia',   flagEmoji: '🇦🇺', pot: 2 },
  // ── Pot 3 ────────────────────────────────────────────────────────────────
  { name: 'Italy',       flagEmoji: '🇮🇹', pot: 3 },
  { name: 'Poland',      flagEmoji: '🇵🇱', pot: 3 },
  { name: 'Serbia',      flagEmoji: '🇷🇸', pot: 3 },
  { name: 'Ukraine',     flagEmoji: '🇺🇦', pot: 3 },
  { name: 'Turkey',      flagEmoji: '🇹🇷', pot: 3 },
  { name: 'Iran',        flagEmoji: '🇮🇷', pot: 3 },
  { name: 'Saudi Arabia',flagEmoji: '🇸🇦', pot: 3 },
  { name: 'Egypt',       flagEmoji: '🇪🇬', pot: 3 },
  { name: 'Nigeria',     flagEmoji: '🇳🇬', pot: 3 },
  { name: "Ivory Coast", flagEmoji: '🇨🇮', pot: 3 },
  { name: 'Venezuela',   flagEmoji: '🇻🇪', pot: 3 },
  { name: 'Chile',       flagEmoji: '🇨🇱', pot: 3 },
  // ── Pot 4 ────────────────────────────────────────────────────────────────
  { name: 'Cameroon',    flagEmoji: '🇨🇲', pot: 4 },
  { name: 'Ghana',       flagEmoji: '🇬🇭', pot: 4 },
  { name: 'Algeria',     flagEmoji: '🇩🇿', pot: 4 },
  { name: 'Tunisia',     flagEmoji: '🇹🇳', pot: 4 },
  { name: 'Panama',      flagEmoji: '🇵🇦', pot: 4 },
  { name: 'Costa Rica',  flagEmoji: '🇨🇷', pot: 4 },
  { name: 'Honduras',    flagEmoji: '🇭🇳', pot: 4 },
  { name: 'New Zealand', flagEmoji: '🇳🇿', pot: 4 },
  { name: 'Iraq',        flagEmoji: '🇮🇶', pot: 4 },
  { name: 'Czech Republic', flagEmoji: '🇨🇿', pot: 4 },
  { name: 'Scotland',    flagEmoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', pot: 4 },
  { name: 'DR Congo',    flagEmoji: '🇨🇩', pot: 4 },
];

/** Pool-ready TournamentTeam[] built from the hardcoded fallback list. */
export const WC2026_FALLBACK_TEAMS: TournamentTeam[] = FALLBACK_LIST.map(f => ({
  id: tid(),
  name: f.name,
  flagEmoji: f.flagEmoji,
  pot: f.pot,
  status: 'active' as const,
}));

/** Pre-built lookup: lower-case team name → pot (1–4). Derived from FALLBACK_LIST. */
export const NAME_TO_POT: Readonly<Record<string, number>> = Object.fromEntries(
  FALLBACK_LIST.map(f => [f.name.toLowerCase(), f.pot]),
);

// ── Convert canonical WorldCupTeam[] → TournamentTeam[] ──────────────────────

/**
 * Convert WorldCupTeam rows from the DB into TournamentTeam objects
 * ready for use inside a pool's teams array.
 *
 * Pot resolution priority:
 *   1. wt.pot (set on DB row after schema migration)
 *   2. NAME_TO_POT lookup from the verified fallback list
 *   3. derivePot() heuristic (last resort)
 */
export function toPoolTeams(wcTeams: WorldCupTeam[]): TournamentTeam[] {
  return wcTeams.map((wt, i) => ({
    id: `wct-live-${i}-${wt.providerTeamId}`,
    name: wt.name,
    flagEmoji: wt.code ? countryCodeToEmoji(wt.code) : '🏳',
    pot: wt.pot ?? NAME_TO_POT[wt.name.toLowerCase()] ?? derivePot(wt),
    group: wt.group,
    status: mapStageToStatus(wt.stage),
    providerTeamId: wt.providerTeamId,
  }));
}

/**
 * Decide which team list to use and label the source.
 *
 * - 48+ teams from DB  → 'official' (use live data)
 * - 1–47 teams from DB → 'incomplete_canonical' (use fallback, show warning)
 * - 0 teams            → 'demo_fallback'
 */
export function resolveTeamSource(wcTeams: WorldCupTeam[]): {
  teams: TournamentTeam[];
  teamsSource: 'official' | 'demo_fallback' | 'incomplete_canonical';
  warning?: string;
} {
  if (wcTeams.length >= 48) {
    return { teams: toPoolTeams(wcTeams), teamsSource: 'official' };
  }
  const fallback = WC2026_FALLBACK_TEAMS.map(t => ({ ...t }));
  if (wcTeams.length >= 1) {
    return {
      teams: fallback,
      teamsSource: 'incomplete_canonical',
      warning: 'World Cup teams are still loading. Using built-in demo teams for now.',
    };
  }
  return { teams: fallback, teamsSource: 'demo_fallback' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert 2-letter ISO country code to flag emoji. */
function countryCodeToEmoji(code: string): string {
  const upper = code.toUpperCase().replace('UK', 'GB');
  if (upper.length !== 2) return '🏳';
  const offset = 0x1F1E6 - 'A'.charCodeAt(0);
  return String.fromCodePoint(upper.charCodeAt(0) + offset, upper.charCodeAt(1) + offset);
}

/** Derive pot (1–4) from the WorldCupTeam stage field or group name.
 *  Falls back to pot 1 for hosts, else pot 2. */
function derivePot(team: WorldCupTeam): number {
  // If the server already encodes pot in the group field ("Pot 1", "Pot 2" etc.)
  if (team.group) {
    const m = team.group.match(/pot\s*([1-4])/i);
    if (m) return parseInt(m[1]);
  }
  // Try the code for known hosts
  const code = team.code?.toUpperCase() ?? '';
  if (['USA', 'MEX', 'CAN'].includes(code)) return 1;
  return 2; // sensible default — user can edit inside the pool
}

function mapStageToStatus(stage: string): TournamentTeam['status'] {
  switch (stage) {
    case 'round_of_16':   return 'round_of_16';
    case 'quarter_final': return 'quarter_final';
    case 'semi_final':    return 'semi_final';
    case 'final':         return 'final';
    case 'winner':        return 'winner';
    case 'eliminated':    return 'eliminated';
    default:              return 'active';
  }
}
