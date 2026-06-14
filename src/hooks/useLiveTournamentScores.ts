import { useMemo } from 'react';
import type { TournamentPoolTrackerContent } from '../types';
import { buildEffectiveMatches, buildEffectiveTeamStages, calcTournamentScores } from '../lib/tournamentScoring';
import type { ParticipantScore } from '../lib/tournamentScoring';
import { enrichPoolTeams, liveResultsEnabled } from '../lib/poolLiveSync';
import { useWorldCupData } from './useWorldCupData';

/**
 * Live leaderboard for a tournament pool: merges canonical world_cup_matches
 * results into the pool's own matches and recomputes scores. Returns null
 * when live results are disabled or canonical data hasn't loaded (yet) —
 * callers fall back to their pool-only calculation.
 *
 * Used by both the owner's renderer and the shared read view so everyone
 * sees the same numbers.
 */
export function useLiveTournamentScores(
  content: TournamentPoolTrackerContent,
): ParticipantScore[] | null {
  const enabled = liveResultsEnabled(content);
  const wc = useWorldCupData(enabled);

  return useMemo(() => {
    if (!enabled || !wc.loaded) return null;
    const teams = enrichPoolTeams(content.teams, wc.teams);
    const effectiveMatches = buildEffectiveMatches(
      teams,
      content.matches,
      wc.matches,
      content.autoSettings?.allowManualOverrides ?? true,
    );
    const teamStages = buildEffectiveTeamStages(teams, wc.teams);
    return calcTournamentScores(
      content.participants,
      teams,
      effectiveMatches,
      teamStages,
      content.scoringRules,
    );
  }, [enabled, wc, content]);
}
