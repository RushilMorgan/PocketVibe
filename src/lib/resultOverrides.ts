import type { TournamentTeam, TournamentMatch, WorldCupMatch } from '../types';
import { uid } from './uid';

/**
 * Admin corrections to canonical World Cup results.
 *
 * Synced results come from Gemini + web search and are occasionally wrong
 * (e.g. a score reported with the teams the wrong way round). The pool admin
 * can override any synced fixture; the correction is stored as a pool match
 * linked to the canonical fixture via providerMatchId + isManualOverride, so
 * it flows into BOTH scoring (buildEffectiveMatches) and the displayed
 * results — and survives future syncs (the sync never touches pool matches).
 */

function poolToProvider(teams: TournamentTeam[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of teams) if (t.providerTeamId != null) m.set(t.id, t.providerTeamId);
  return m;
}

type CanonicalRef = Pick<WorldCupMatch, 'providerMatchId' | 'homeTeamId' | 'awayTeamId'>;

/** Does a pool match refer to the same fixture as a canonical match? */
export function isSameFixture(m: TournamentMatch, wcm: CanonicalRef, poolTeams: TournamentTeam[]): boolean {
  if (m.providerMatchId != null && m.providerMatchId === wcm.providerMatchId) return true;
  const p2 = poolToProvider(poolTeams);
  const a = p2.get(m.teamAId);
  const b = p2.get(m.teamBId);
  if (a == null || b == null) return false;
  return (a === wcm.homeTeamId && b === wcm.awayTeamId) || (a === wcm.awayTeamId && b === wcm.homeTeamId);
}

/** The admin's correction for a canonical fixture, if one exists (must be scored). */
export function findResultOverride(
  matches: TournamentMatch[],
  wcm: CanonicalRef,
  poolTeams: TournamentTeam[],
): TournamentMatch | undefined {
  const scored = matches.filter(m => m.scoreA !== undefined && m.scoreB !== undefined);
  // Prefer an explicit providerMatchId link, newest last
  for (let i = scored.length - 1; i >= 0; i--) {
    if (scored[i].providerMatchId === wcm.providerMatchId) return scored[i];
  }
  for (let i = scored.length - 1; i >= 0; i--) {
    if (isSameFixture(scored[i], wcm, poolTeams)) return scored[i];
  }
  return undefined;
}

export interface OrientedScore {
  homeScore?: number;
  awayScore?: number;
  isManual: boolean;
}

/**
 * The score to DISPLAY for a canonical fixture, oriented to its home/away,
 * with any admin override applied (re-oriented to match).
 */
export function resolveCanonicalScore(
  wcm: WorldCupMatch,
  override: TournamentMatch | undefined,
  poolTeams: TournamentTeam[],
): OrientedScore {
  if (!override) {
    return { homeScore: wcm.scoreHome, awayScore: wcm.scoreAway, isManual: Boolean(wcm.isManualOverride) };
  }
  const aProv = poolToProvider(poolTeams).get(override.teamAId);
  // override.teamA is the canonical home team → scores align; otherwise swap
  return aProv === wcm.homeTeamId
    ? { homeScore: override.scoreA, awayScore: override.scoreB, isManual: true }
    : { homeScore: override.scoreB, awayScore: override.scoreA, isManual: true };
}

/**
 * Store (or replace) an admin correction for a canonical fixture. Scores are
 * given in canonical home/away order. Any prior pool match for the same
 * fixture is dropped so corrections never stack. No-op if either team isn't
 * in the pool (can't link the override).
 */
export function setResultOverride(
  matches: TournamentMatch[],
  wcm: WorldCupMatch,
  poolTeams: TournamentTeam[],
  homeScore: number,
  awayScore: number,
): TournamentMatch[] {
  const provToPool = new Map<number, string>();
  for (const t of poolTeams) if (t.providerTeamId != null) provToPool.set(t.providerTeamId, t.id);
  const homePool = provToPool.get(wcm.homeTeamId);
  const awayPool = provToPool.get(wcm.awayTeamId);
  if (!homePool || !awayPool) return matches;

  const cleaned = matches.filter(m => !isSameFixture(m, wcm, poolTeams));
  const corrected: TournamentMatch = {
    id: uid('ovr'),
    teamAId: homePool,
    teamBId: awayPool,
    scoreA: homeScore,
    scoreB: awayScore,
    providerMatchId: wcm.providerMatchId,
    isManualOverride: true,
    stage: wcm.stage,
  };
  return [...cleaned, corrected];
}
