import { useEffect, useMemo, useState } from 'react';
import type { TournamentPoolTrackerContent, WorldCupTeam, WorldCupMatch } from '../types';
import { getWorldCupData } from '../services/worldCupService';
import { buildEffectiveMatches, buildEffectiveTeamStages, calcTournamentScores } from '../lib/tournamentScoring';
import type { ParticipantScore } from '../lib/tournamentScoring';
import { enrichPoolTeams, liveResultsEnabled } from '../lib/poolLiveSync';

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
  const [wc, setWc] = useState<{ teams: WorldCupTeam[]; matches: WorldCupMatch[] } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      getWorldCupData()
        .then(data => { if (!cancelled) setWc(data); })
        .catch(() => { /* offline / not configured — pool-only scores still work */ });
    };
    load();
    // Keep open pages current during match evenings — no refresh needed
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [enabled]);

  return useMemo(() => {
    if (!enabled || !wc) return null;
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
