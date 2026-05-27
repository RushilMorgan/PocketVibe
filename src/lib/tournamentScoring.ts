/**
 * Pure scoring functions for Tournament Pool Tracker.
 * Extracted so they can be unit-tested independently of any React component.
 *
 * Two modes:
 *  - Pool-only:  calcScoresFromPool(content)  — uses content.matches + team.status
 *  - Auto-results: calcScoresWithCanonical(...)  — merges canonical WC data in
 */
import type {
  TournamentParticipant,
  TournamentTeam,
  TournamentMatch,
  TournamentScoringRules,
  TournamentTeamStatus,
  TournamentPoolTrackerContent,
  WorldCupMatch,
  WorldCupTeam,
} from '../types';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface EffectiveMatch {
  teamAId: string;        // pool-local team ID
  teamBId: string;
  scoreA?: number;
  scoreB?: number;
  isManualOverride: boolean;
}

export interface ParticipantScore {
  participant: TournamentParticipant;
  teams: TournamentTeam[];
  points: number;
  wins: number;
  draws: number;
}

// ── Core scoring function ─────────────────────────────────────────────────────

/**
 * Calculate scores for all participants.
 * @param teamStages  Map of pool-team-ID → TournamentTeamStatus
 *                    Comes from pool team.status (manual) or canonical WC data.
 */
export function calcTournamentScores(
  participants: TournamentParticipant[],
  teams: TournamentTeam[],
  effectiveMatches: EffectiveMatch[],
  teamStages: Map<string, TournamentTeamStatus>,
  rules: TournamentScoringRules,
): ParticipantScore[] {
  return participants
    .map(p => {
      const myTeams = teams.filter(t => t.assignedTo === p.id);
      const myIds   = new Set(myTeams.map(t => t.id));
      let points = 0, wins = 0, draws = 0;

      for (const m of effectiveMatches) {
        if (m.scoreA === undefined || m.scoreB === undefined) continue;
        const aMe = myIds.has(m.teamAId);
        const bMe = myIds.has(m.teamBId);
        if (!aMe && !bMe) continue;

        if (m.scoreA > m.scoreB) {
          if (aMe) { points += rules.pointsPerWin; wins++; }
        } else if (m.scoreB > m.scoreA) {
          if (bMe) { points += rules.pointsPerWin; wins++; }
        } else {
          if (aMe) { points += rules.pointsPerDraw; draws++; }
          if (bMe) { points += rules.pointsPerDraw; draws++; }
        }
      }

      for (const team of myTeams) {
        const stage = teamStages.get(team.id) ?? team.status;
        switch (stage) {
          case 'round_of_16':   points += rules.knockoutBonus;      break;
          case 'quarter_final': points += rules.quarterFinalBonus;  break;
          case 'semi_final':    points += rules.semiFinalBonus;     break;
          case 'final':         points += rules.finalBonus;         break;
          case 'winner':        points += rules.winnerBonus;        break;
        }
      }

      return { participant: p, teams: myTeams, points, wins, draws };
    })
    .sort((a, b) => b.points - a.points);
}

// ── Pool-only helper ──────────────────────────────────────────────────────────

/** Convenience wrapper: use pool content as-is (no canonical data). */
export function calcScoresFromPool(content: TournamentPoolTrackerContent): ParticipantScore[] {
  const effectiveMatches: EffectiveMatch[] = content.matches.map(m => ({
    teamAId: m.teamAId,
    teamBId: m.teamBId,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    isManualOverride: m.isManualOverride ?? false,
  }));
  const teamStages = new Map<string, TournamentTeamStatus>(
    content.teams.map(t => [t.id, t.status]),
  );
  return calcTournamentScores(
    content.participants,
    content.teams,
    effectiveMatches,
    teamStages,
    content.scoringRules,
  );
}

// ── Canonical merge helpers ───────────────────────────────────────────────────

/**
 * Build an EffectiveMatch list by merging pool matches with canonical WC matches.
 *
 * Rules:
 *  - Canonical matches involving at least one pool team are included.
 *  - If allowManualOverrides = true AND a pool match has matching providerMatchId,
 *    the pool match wins (admin correction).
 *  - Pool matches without a providerMatchId are always included (custom matches).
 *  - If allowManualOverrides = false, canonical data always wins for known matches.
 */
export function buildEffectiveMatches(
  poolTeams: TournamentTeam[],
  poolMatches: TournamentMatch[],
  wcMatches: WorldCupMatch[],
  allowManualOverrides: boolean,
): EffectiveMatch[] {
  // Map: providerTeamId → pool team ID
  const providerToPool = new Map<number, string>();
  for (const team of poolTeams) {
    if (team.providerTeamId != null) {
      providerToPool.set(team.providerTeamId, team.id);
    }
  }

  // Map: providerMatchId → pool manual match (only when allowManualOverrides)
  const manualByProvider = new Map<number, TournamentMatch>();
  if (allowManualOverrides) {
    for (const m of poolMatches) {
      if (m.isManualOverride && m.providerMatchId != null) {
        manualByProvider.set(m.providerMatchId, m);
      }
    }
  }

  const result: EffectiveMatch[] = [];
  const coveredProviderIds = new Set<number>();

  // Process each canonical match
  for (const wcm of wcMatches) {
    if (wcm.status !== 'finished' && wcm.status !== 'live') continue;

    const teamAId = providerToPool.get(wcm.homeTeamId);
    const teamBId = providerToPool.get(wcm.awayTeamId);
    // At least one team must be in this pool to matter
    if (!teamAId && !teamBId) continue;

    coveredProviderIds.add(wcm.providerMatchId);

    const override = manualByProvider.get(wcm.providerMatchId);
    if (override) {
      result.push({
        teamAId: override.teamAId,
        teamBId: override.teamBId,
        scoreA:  override.scoreA,
        scoreB:  override.scoreB,
        isManualOverride: true,
      });
    } else {
      // Include matches where at least one team is in the pool.
      // Unowned opponents use a sentinel ID (no participant owns it, so scoring is correct).
      const resolvedA = teamAId ?? `__ext_${wcm.homeTeamId}`;
      const resolvedB = teamBId ?? `__ext_${wcm.awayTeamId}`;
      result.push({
        teamAId: resolvedA,
        teamBId: resolvedB,
        scoreA: wcm.scoreHome,
        scoreB: wcm.scoreAway,
        isManualOverride: false,
      });
    }
  }

  // Include pool matches that don't correspond to any canonical match
  for (const m of poolMatches) {
    if (m.providerMatchId != null && coveredProviderIds.has(m.providerMatchId)) continue;
    result.push({
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      scoreA:  m.scoreA,
      scoreB:  m.scoreB,
      isManualOverride: m.isManualOverride ?? false,
    });
  }

  return result;
}

/**
 * Build a Map of pool-team-ID → TournamentTeamStatus, preferring canonical
 * WC team stages over the pool's manually-set team.status values.
 */
export function buildEffectiveTeamStages(
  poolTeams: TournamentTeam[],
  wcTeams: WorldCupTeam[],
): Map<string, TournamentTeamStatus> {
  const VALID_STATUSES: TournamentTeamStatus[] = [
    'active', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'winner', 'eliminated',
  ];

  const providerToStage = new Map<number, TournamentTeamStatus>();
  for (const wct of wcTeams) {
    const s = wct.stage as TournamentTeamStatus;
    if (VALID_STATUSES.includes(s)) {
      providerToStage.set(wct.providerTeamId, s);
    }
  }

  const result = new Map<string, TournamentTeamStatus>();
  for (const team of poolTeams) {
    if (team.providerTeamId != null && providerToStage.has(team.providerTeamId)) {
      result.set(team.id, providerToStage.get(team.providerTeamId)!);
    } else {
      result.set(team.id, team.status);
    }
  }
  return result;
}
