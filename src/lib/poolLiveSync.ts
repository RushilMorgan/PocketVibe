import type { TournamentTeam, TournamentPoolTrackerContent, WorldCupTeam } from '../types';

/**
 * Glue between a tournament pool and the canonical world_cup_* data.
 *
 * Pools created while the DB teams table was empty were built from the
 * client fallback list, whose teams carry NO providerTeamId — so canonical
 * results could never be mapped onto them. These helpers close that gap by
 * matching on normalised team names, and make auto-results the default for
 * World Cup pools.
 */

// Mirrors TEAM_ALIASES in supabase/functions/sync-world-cup-results/index.ts
const NAME_ALIASES: Record<string, string> = {
  'usa': 'united states',
  'usmnt': 'united states',
  'united states of america': 'united states',
  'korea republic': 'south korea',
  'republic of korea': 'south korea',
  'korea': 'south korea',
  "cote d'ivoire": "côte d'ivoire",
  'ivory coast': "côte d'ivoire",
  'cape verde': 'cabo verde',
  'congo dr': 'dr congo',
  'democratic republic of congo': 'dr congo',
  'democratic republic of the congo': 'dr congo',
  'drc': 'dr congo',
  'bosnia': 'bosnia and herzegovina',
  'bosnia-herzegovina': 'bosnia and herzegovina',
  'türkiye': 'turkey',
  'turkiye': 'turkey',
  'czech republic': 'czechia',
  'holland': 'netherlands',
  'the netherlands': 'netherlands',
  'curaçao': 'curacao',
};

export function normaliseTeamName(name: string): string {
  const lower = (name ?? '').trim().toLowerCase();
  return NAME_ALIASES[lower] ?? lower;
}

/**
 * Attach providerTeamId to pool teams that lack one, by normalised-name
 * match against the canonical team list. Returns the original array when
 * nothing changed (referential stability for memoisation).
 */
export function enrichPoolTeams(
  poolTeams: TournamentTeam[],
  wcTeams: WorldCupTeam[],
): TournamentTeam[] {
  const byName = new Map<string, number>();
  for (const wt of wcTeams) byName.set(normaliseTeamName(wt.name), wt.providerTeamId);

  let changed = false;
  const out = poolTeams.map(t => {
    if (t.providerTeamId != null) return t;
    const pid = byName.get(normaliseTeamName(t.name));
    if (pid == null) return t;
    changed = true;
    return { ...t, providerTeamId: pid };
  });
  return changed ? out : poolTeams;
}

/** A pool built from the World Cup flow (teamsSource set) or named after it. */
export function isWorldCupPool(content: TournamentPoolTrackerContent): boolean {
  return content.teamsSource != null || /world\s*cup/i.test(content.tournamentName ?? '');
}

/**
 * Whether the leaderboard should merge canonical live results.
 * An explicit setting always wins; World Cup pools default to ON — pools
 * created before autoSettings existed (autoSettings === undefined) get live
 * results without needing to be rebuilt.
 */
export function liveResultsEnabled(content: TournamentPoolTrackerContent): boolean {
  return content.autoSettings?.autoResultsEnabled ?? isWorldCupPool(content);
}
