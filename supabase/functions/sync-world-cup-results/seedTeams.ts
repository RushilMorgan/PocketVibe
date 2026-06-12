/**
 * Canonical WC 2026 team seed for the results sync — dependency-free so
 * vitest can verify it from src/__tests__ (mirrors the client's
 * WC2026 fallback list in src/lib/worldCupTeams.ts; names must stay aligned
 * with TEAM_ALIASES normalisation in index.ts).
 *
 * The world_cup_teams table ships empty (schema-world-cup.sql has no seed),
 * so the sync self-heals: any canonical team missing from the DB is inserted
 * with a synthetic provider_team_id before results are matched.
 */

export interface SeedTeam {
  name: string;
  pot: number;
  fifaRank: number;
}

export const WC2026_SEED_TEAMS: SeedTeam[] = [
  // Pot 1 — hosts + top-ranked
  { name: 'Spain', pot: 1, fifaRank: 1 },
  { name: 'Argentina', pot: 1, fifaRank: 2 },
  { name: 'France', pot: 1, fifaRank: 3 },
  { name: 'England', pot: 1, fifaRank: 4 },
  { name: 'Brazil', pot: 1, fifaRank: 5 },
  { name: 'Portugal', pot: 1, fifaRank: 6 },
  { name: 'Netherlands', pot: 1, fifaRank: 7 },
  { name: 'Belgium', pot: 1, fifaRank: 8 },
  { name: 'Germany', pot: 1, fifaRank: 9 },
  { name: 'USA', pot: 1, fifaRank: 14 },
  { name: 'Mexico', pot: 1, fifaRank: 15 },
  { name: 'Canada', pot: 1, fifaRank: 27 },
  // Pot 2
  { name: 'Croatia', pot: 2, fifaRank: 10 },
  { name: 'Morocco', pot: 2, fifaRank: 11 },
  { name: 'Colombia', pot: 2, fifaRank: 13 },
  { name: 'Uruguay', pot: 2, fifaRank: 16 },
  { name: 'Switzerland', pot: 2, fifaRank: 17 },
  { name: 'Japan', pot: 2, fifaRank: 18 },
  { name: 'Senegal', pot: 2, fifaRank: 19 },
  { name: 'Iran', pot: 2, fifaRank: 20 },
  { name: 'South Korea', pot: 2, fifaRank: 22 },
  { name: 'Ecuador', pot: 2, fifaRank: 23 },
  { name: 'Austria', pot: 2, fifaRank: 24 },
  { name: 'Australia', pot: 2, fifaRank: 26 },
  // Pot 3
  { name: 'Norway', pot: 3, fifaRank: 29 },
  { name: 'Panama', pot: 3, fifaRank: 30 },
  { name: 'Egypt', pot: 3, fifaRank: 34 },
  { name: 'Algeria', pot: 3, fifaRank: 35 },
  { name: 'Scotland', pot: 3, fifaRank: 36 },
  { name: 'Paraguay', pot: 3, fifaRank: 39 },
  { name: 'Tunisia', pot: 3, fifaRank: 40 },
  { name: 'Ivory Coast', pot: 3, fifaRank: 42 },
  { name: 'Uzbekistan', pot: 3, fifaRank: 50 },
  { name: 'Qatar', pot: 3, fifaRank: 51 },
  { name: 'Saudi Arabia', pot: 3, fifaRank: 60 },
  { name: 'South Africa', pot: 3, fifaRank: 61 },
  // Pot 4
  { name: 'Jordan', pot: 4, fifaRank: 66 },
  { name: 'Cape Verde', pot: 4, fifaRank: 68 },
  { name: 'Ghana', pot: 4, fifaRank: 72 },
  { name: 'Curaçao', pot: 4, fifaRank: 82 },
  { name: 'Haiti', pot: 4, fifaRank: 84 },
  { name: 'New Zealand', pot: 4, fifaRank: 86 },
  { name: 'Bosnia', pot: 4, fifaRank: 57 },
  { name: 'Sweden', pot: 4, fifaRank: 25 },
  { name: 'Turkey', pot: 4, fifaRank: 28 },
  { name: 'Czechia', pot: 4, fifaRank: 38 },
  { name: 'DR Congo', pot: 4, fifaRank: 100 },
  { name: 'Iraq', pot: 4, fifaRank: 80 },
];

/**
 * Stable synthetic provider_team_id for self-seeded teams. Real
 * API-Football ids are small integers, so seeded ids live in a 9M+ range
 * where they can never collide with provider data.
 */
export function syntheticTeamId(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return 9_000_000 + (h % 900_000);
}
