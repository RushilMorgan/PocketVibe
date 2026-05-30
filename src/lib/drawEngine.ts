/**
 * drawEngine — Fair Seeded Draw for tournament pools.
 *
 * One algorithm: every team is assigned. Pot 1 is distributed as evenly as
 * mathematically possible (±1 when counts don't divide evenly). Lower pots are
 * assigned in rounds so every participant receives an equal share (±1), with
 * the strongest available teams going to participants who have the least
 * accumulated strength — compensating participants who missed out on extra Pot 1.
 */
import type { TournamentTeam, TournamentParticipant } from '../types';

export interface PotBreakdown {
  [pot: number]: number;
}

export interface ParticipantDrawSummary {
  id: string;
  totalTeams: number;
  potBreakdown: PotBreakdown;
  strengthScore: number;
}

export interface DrawResult {
  /** All teams with `assignedTo` populated — no team is left unassigned. */
  teams: TournamentTeam[];
  /** Always empty — every team is assigned by the fair draw. */
  unassigned: TournamentTeam[];
  /** participantId → { potNumber: teamCount } */
  potBreakdown: Map<string, PotBreakdown>;
  /** Non-null when Pot 1 cannot divide evenly across participants. */
  fairnessWarning: string | null;
  /** Per-participant summary after the draw. */
  participantSummaries: Map<string, ParticipantDrawSummary>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Derive a strength score for a team.
 * Higher = stronger. Pot 1 teams score highest; within a pot, lower FIFA rank = higher score.
 * Uses `team.strengthScore` if already set; otherwise computes from pot + fifaRank.
 */
export function teamStrength(team: TournamentTeam): number {
  if (team.strengthScore != null) return team.strengthScore;
  // Pot 1 → base 400, Pot 2 → 300, Pot 3 → 200, Pot 4 → 100
  const base = Math.max(1, 5 - team.pot) * 100;
  // FIFA rank bonus: rank 1 = +99, rank 100 = +0 (clamped at 0)
  const rankBonus = team.fifaRank != null ? Math.max(0, 100 - team.fifaRank) : 50;
  return base + rankBonus;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run Fair Seeded Draw — the single Toolie draw algorithm.
 *
 * Steps:
 *  1. Shuffle teams within each pot; shuffle participants.
 *  2. Assign Pot 1: every participant gets floor(pot1/n) teams; if there is a
 *     remainder, a random subset of participants each receive one extra.
 *  3. Assign Pot 2–4 in rounds (one team per participant per round):
 *     - Teams are sorted strongest-first.
 *     - In each round, participants are sorted by current accumulated strength
 *       ascending so the weakest participant gets the strongest remaining team.
 *     - Remainder teams (if pot size doesn't divide evenly) go to participants
 *       with the fewest teams assigned so far (tie: lowest strength first).
 *  4. Result: no team is left unassigned; each participant's team count differs
 *     by at most 1; participants who received extra Pot 1 teams are steered
 *     toward weaker lower-pot allocations.
 */
export function runFairSeededDraw(
  teams: TournamentTeam[],
  participants: TournamentParticipant[],
): DrawResult {
  if (participants.length === 0) {
    return {
      teams,
      unassigned: [...teams],
      potBreakdown: new Map(),
      fairnessWarning: null,
      participantSummaries: new Map(),
    };
  }

  const n = participants.length;
  // Clear any prior assignments so re-runs are idempotent.
  const result: TournamentTeam[] = teams.map(t => ({ ...t, assignedTo: undefined }));
  const pots = [...new Set(result.map(t => t.pot))].sort((a, b) => a - b);

  const potBreakdown = new Map<string, PotBreakdown>();
  const strengthTally = new Map<string, number>(); // accumulated strength per participant
  const teamCount = new Map<string, number>();      // teams assigned per participant

  for (const p of participants) {
    potBreakdown.set(p.id, {});
    strengthTally.set(p.id, 0);
    teamCount.set(p.id, 0);
  }

  let pot1Uneven = false;

  function assignTeam(teamId: string, participantId: string) {
    const ri = result.findIndex(t => t.id === teamId);
    const team = result[ri];
    result[ri] = { ...team, assignedTo: participantId };
    const bd = potBreakdown.get(participantId)!;
    bd[team.pot] = (bd[team.pot] ?? 0) + 1;
    strengthTally.set(participantId, (strengthTally.get(participantId) ?? 0) + teamStrength(team));
    teamCount.set(participantId, (teamCount.get(participantId) ?? 0) + 1);
  }

  /** Sort participants by strength ascending; ties broken by fewest teams, then original order. */
  function byStrengthAsc(): TournamentParticipant[] {
    return [...participants].sort((a, b) => {
      const sA = strengthTally.get(a.id) ?? 0;
      const sB = strengthTally.get(b.id) ?? 0;
      if (sA !== sB) return sA - sB;
      return (teamCount.get(a.id) ?? 0) - (teamCount.get(b.id) ?? 0);
    });
  }

  /** Sort participants by fewest teams ascending; ties broken by lowest strength. */
  function byTeamCountAsc(): TournamentParticipant[] {
    return [...participants].sort((a, b) => {
      const cA = teamCount.get(a.id) ?? 0;
      const cB = teamCount.get(b.id) ?? 0;
      if (cA !== cB) return cA - cB;
      return (strengthTally.get(a.id) ?? 0) - (strengthTally.get(b.id) ?? 0);
    });
  }

  for (const pot of pots) {
    const potTeams = shuffle(result.filter(t => t.pot === pot));

    if (pot === 1) {
      // Sort Pot 1 by strength desc so strongest teams are assigned in the base
      // rounds and any remainder teams (the weakest Pot 1 teams) go last.
      const sortedPot1 = [...potTeams].sort((a, b) => teamStrength(b) - teamStrength(a));
      const shuffledP = shuffle([...participants]);
      const base = Math.floor(sortedPot1.length / n);
      const rem = sortedPot1.length % n;
      if (rem > 0) pot1Uneven = true;

      let idx = 0;
      for (const p of shuffledP) {
        for (let j = 0; j < base; j++) assignTeam(sortedPot1[idx++].id, p.id);
      }
      // Remainder: the weakest remaining Pot 1 teams go to a random subset.
      for (let i = 0; i < rem; i++) assignTeam(sortedPot1[idx++].id, shuffledP[i].id);
    } else {
      // Lower pots: sort teams by strength descending, assign in rounds.
      // Each round: participant with lowest current strength gets the strongest remaining team.
      const sorted = [...potTeams].sort((a, b) => teamStrength(b) - teamStrength(a));
      const base = Math.floor(sorted.length / n);
      const rem = sorted.length % n;
      let idx = 0;

      for (let round = 0; round < base; round++) {
        // Re-sort each round because assignments in previous rounds change relative strengths.
        const ordered = byStrengthAsc();
        for (const p of ordered) {
          assignTeam(sorted[idx++].id, p.id);
        }
      }

      // Remainder: goes to participants with the fewest teams (tie: lowest strength).
      if (rem > 0) {
        const ordered = byTeamCountAsc();
        for (let i = 0; i < rem; i++) {
          assignTeam(sorted[idx++].id, ordered[i].id);
        }
      }
    }
  }

  // Build per-participant summaries.
  const participantSummaries = new Map<string, ParticipantDrawSummary>();
  for (const p of participants) {
    participantSummaries.set(p.id, {
      id: p.id,
      totalTeams: teamCount.get(p.id) ?? 0,
      potBreakdown: potBreakdown.get(p.id) ?? {},
      strengthScore: strengthTally.get(p.id) ?? 0,
    });
  }

  return {
    teams: result,
    unassigned: [],
    potBreakdown,
    fairnessWarning: pot1Uneven
      ? `Some players received extra top-pot teams because ${result.length} teams cannot split perfectly between ${n} people. Toolie balanced the lower pots to keep the draw as fair as possible.`
      : null,
    participantSummaries,
  };
}
