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
  fifaRank: number;
}

// All 48 confirmed FIFA World Cup 2026 qualifiers.
// Pots from the official draw (December 5, 2025), FIFA ranks from the
// November 19, 2025 FIFA Men's World Ranking used for draw seeding.
// Playoff winners were placed in Pot 4 regardless of their FIFA rank.
const FALLBACK_LIST: FallbackTeam[] = [
  // ── Pot 1 — hosts + 9 highest-ranked qualified teams ─────────────────────
  { name: 'Spain',              flagEmoji: '🇪🇸', pot: 1, fifaRank: 1  },
  { name: 'Argentina',          flagEmoji: '🇦🇷', pot: 1, fifaRank: 2  },
  { name: 'France',             flagEmoji: '🇫🇷', pot: 1, fifaRank: 3  },
  { name: 'England',            flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', pot: 1, fifaRank: 4  },
  { name: 'Brazil',             flagEmoji: '🇧🇷', pot: 1, fifaRank: 5  },
  { name: 'Portugal',           flagEmoji: '🇵🇹', pot: 1, fifaRank: 6  },
  { name: 'Netherlands',        flagEmoji: '🇳🇱', pot: 1, fifaRank: 7  },
  { name: 'Belgium',            flagEmoji: '🇧🇪', pot: 1, fifaRank: 8  },
  { name: 'Germany',            flagEmoji: '🇩🇪', pot: 1, fifaRank: 9  },
  { name: 'USA',                flagEmoji: '🇺🇸', pot: 1, fifaRank: 14 }, // host
  { name: 'Mexico',             flagEmoji: '🇲🇽', pot: 1, fifaRank: 15 }, // host
  { name: 'Canada',             flagEmoji: '🇨🇦', pot: 1, fifaRank: 27 }, // host
  // ── Pot 2 — qualified teams ranked 13–24 among all qualifiers ────────────
  { name: 'Croatia',            flagEmoji: '🇭🇷', pot: 2, fifaRank: 10 },
  { name: 'Morocco',            flagEmoji: '🇲🇦', pot: 2, fifaRank: 11 },
  { name: 'Colombia',           flagEmoji: '🇨🇴', pot: 2, fifaRank: 13 },
  { name: 'Uruguay',            flagEmoji: '🇺🇾', pot: 2, fifaRank: 16 },
  { name: 'Switzerland',        flagEmoji: '🇨🇭', pot: 2, fifaRank: 17 },
  { name: 'Japan',              flagEmoji: '🇯🇵', pot: 2, fifaRank: 18 },
  { name: 'Senegal',            flagEmoji: '🇸🇳', pot: 2, fifaRank: 19 },
  { name: 'Iran',               flagEmoji: '🇮🇷', pot: 2, fifaRank: 20 },
  { name: 'South Korea',        flagEmoji: '🇰🇷', pot: 2, fifaRank: 22 },
  { name: 'Ecuador',            flagEmoji: '🇪🇨', pot: 2, fifaRank: 23 },
  { name: 'Austria',            flagEmoji: '🇦🇹', pot: 2, fifaRank: 24 },
  { name: 'Australia',          flagEmoji: '🇦🇺', pot: 2, fifaRank: 26 },
  // ── Pot 3 — qualified teams ranked 25–36 among all qualifiers ────────────
  { name: 'Norway',             flagEmoji: '🇳🇴', pot: 3, fifaRank: 29 },
  { name: 'Panama',             flagEmoji: '🇵🇦', pot: 3, fifaRank: 30 },
  { name: 'Egypt',              flagEmoji: '🇪🇬', pot: 3, fifaRank: 34 },
  { name: 'Algeria',            flagEmoji: '🇩🇿', pot: 3, fifaRank: 35 },
  { name: 'Scotland',           flagEmoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', pot: 3, fifaRank: 36 },
  { name: 'Paraguay',           flagEmoji: '🇵🇾', pot: 3, fifaRank: 39 },
  { name: 'Tunisia',            flagEmoji: '🇹🇳', pot: 3, fifaRank: 40 },
  { name: 'Ivory Coast',        flagEmoji: '🇨🇮', pot: 3, fifaRank: 42 },
  { name: 'Uzbekistan',         flagEmoji: '🇺🇿', pot: 3, fifaRank: 50 },
  { name: 'Qatar',              flagEmoji: '🇶🇦', pot: 3, fifaRank: 51 },
  { name: 'Saudi Arabia',       flagEmoji: '🇸🇦', pot: 3, fifaRank: 60 },
  { name: 'South Africa',       flagEmoji: '🇿🇦', pot: 3, fifaRank: 61 },
  // ── Pot 4 — lowest-ranked direct qualifiers ───────────────────────────────
  { name: 'Jordan',             flagEmoji: '🇯🇴', pot: 4, fifaRank: 66 },
  { name: 'Cape Verde',         flagEmoji: '🇨🇻', pot: 4, fifaRank: 68 },
  { name: 'Ghana',              flagEmoji: '🇬🇭', pot: 4, fifaRank: 72 },
  { name: 'Curaçao',            flagEmoji: '🇨🇼', pot: 4, fifaRank: 82 },
  { name: 'Haiti',              flagEmoji: '🇭🇹', pot: 4, fifaRank: 84 },
  { name: 'New Zealand',        flagEmoji: '🇳🇿', pot: 4, fifaRank: 86 },
  // ── Pot 4 — European playoff winners (Pot 4 regardless of FIFA rank) ──────
  { name: 'Bosnia',             flagEmoji: '🇧🇦', pot: 4, fifaRank: 57 }, // beat Italy in final
  { name: 'Sweden',             flagEmoji: '🇸🇪', pot: 4, fifaRank: 25 }, // beat Ukraine/Poland
  { name: 'Turkey',             flagEmoji: '🇹🇷', pot: 4, fifaRank: 28 }, // playoff C winner
  { name: 'Czechia',            flagEmoji: '🇨🇿', pot: 4, fifaRank: 38 }, // beat Denmark in final
  // ── Pot 4 — Intercontinental playoff winners ──────────────────────────────
  { name: 'DR Congo',           flagEmoji: '🇨🇩', pot: 4, fifaRank: 100 },
  { name: 'Iraq',               flagEmoji: '🇮🇶', pot: 4, fifaRank: 80  },
];

/** Pool-ready TournamentTeam[] built from the hardcoded fallback list. */
export const WC2026_FALLBACK_TEAMS: TournamentTeam[] = FALLBACK_LIST.map(f => ({
  id: tid(),
  name: f.name,
  flagEmoji: f.flagEmoji,
  pot: f.pot,
  fifaRank: f.fifaRank,
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
    fifaRank: wt.fifaRank,
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
  return {
    teams: fallback,
    teamsSource: 'demo_fallback',
    warning: 'Using built-in demo team list — check teams before locking draw.',
  };
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
