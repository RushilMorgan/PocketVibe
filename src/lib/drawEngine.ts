/**
 * drawEngine — pure, deterministic draw logic for tournament pools.
 *
 * Two modes:
 *  - strict_fair_seeded (default): every participant gets the same number of
 *    teams from each pot. Remainder teams stay unassigned ("bonus pool").
 *  - assign_all_teams: every team is assigned. Remainder Pot 1 teams go to
 *    randomly-selected participants, and a fairness warning is raised.
 */
import type { TournamentTeam, TournamentParticipant } from '../types';

export type DrawMode = 'strict_fair_seeded' | 'assign_all_teams';

export interface PotBreakdown {
  [pot: number]: number;
}

export interface DrawResult {
  /** All teams with `assignedTo` updated (unmodified teams keep their value). */
  teams: TournamentTeam[];
  /** Teams that remain unassigned after the draw. */
  unassigned: TournamentTeam[];
  /** participantId → { potNumber: teamCount } */
  potBreakdown: Map<string, PotBreakdown>;
  /** Non-null in assign_all mode when Pot 1 is uneven. */
  fairnessWarning: string | null;
}

export interface FairnessCheck {
  /** True when any pot's unassigned team count is not divisible by participantCount. */
  hasRemainder: boolean;
  /** Number of Pot 1 teams that would be left unassigned in strict_fair mode. */
  pot1Remainder: number;
  /** Total teams that would be left unassigned in strict_fair mode. */
  strictUnassignedCount: number;
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether a draw will be perfectly fair (no pot remainder).
 * Call this before running a draw to decide whether to show a warning.
 */
export function checkDrawFairness(
  teams: TournamentTeam[],
  participantCount: number,
): FairnessCheck {
  if (participantCount === 0) {
    return { hasRemainder: false, pot1Remainder: 0, strictUnassignedCount: 0 };
  }

  const unassigned = teams.filter(t => !t.assignedTo);
  const pots = [...new Set(unassigned.map(t => t.pot))];

  let hasRemainder = false;
  let pot1Remainder = 0;
  let strictUnassignedCount = 0;

  for (const pot of pots) {
    const count = unassigned.filter(t => t.pot === pot).length;
    const rem = count % participantCount;
    if (rem > 0) {
      hasRemainder = true;
      strictUnassignedCount += rem;
    }
    if (pot === 1) pot1Remainder = rem;
  }

  return { hasRemainder, pot1Remainder, strictUnassignedCount };
}

/**
 * Strict Fair Seeded Draw (default).
 *
 * For each pot:
 *   base = floor(potTeams / participantCount)
 *   Every participant receives exactly `base` teams from that pot.
 *   Remainder teams stay unassigned (shown as "bonus pool").
 *
 * Guarantees: no participant ever gets more Pot 1 teams than another.
 */
export function runStrictFairSeededDraw(
  teams: TournamentTeam[],
  participants: TournamentParticipant[],
): DrawResult {
  if (participants.length === 0) {
    return {
      teams,
      unassigned: teams.filter(t => !t.assignedTo),
      potBreakdown: new Map(),
      fairnessWarning: null,
    };
  }

  const n = participants.length;
  const result: TournamentTeam[] = teams.map(t => ({ ...t }));
  const pots = [...new Set(result.map(t => t.pot))].sort((a, b) => a - b);

  const potBreakdown = new Map<string, PotBreakdown>();
  for (const p of participants) potBreakdown.set(p.id, {});

  for (const pot of pots) {
    const potTeams = shuffle(result.filter(t => t.pot === pot && !t.assignedTo));
    const base = Math.floor(potTeams.length / n);
    if (base === 0) continue; // fewer teams than participants — all stay unassigned

    // Assign in a randomised participant order to avoid position bias
    const order = shuffle([...participants]);
    let idx = 0;

    for (const p of order) {
      for (let j = 0; j < base; j++) {
        const team = potTeams[idx++];
        const ri = result.findIndex(t => t.id === team.id);
        result[ri] = { ...result[ri], assignedTo: p.id };
        const bd = potBreakdown.get(p.id)!;
        bd[pot] = (bd[pot] ?? 0) + 1;
      }
    }
    // Remaining potTeams (the remainder) are intentionally left unassigned.
  }

  return {
    teams: result,
    unassigned: result.filter(t => !t.assignedTo),
    potBreakdown,
    fairnessWarning: null,
  };
}

/**
 * Assign All Teams Draw.
 *
 * Assigns every unassigned team. Base teams go to everyone equally; remainder
 * teams are distributed round-robin to a random subset of participants.
 * If Pot 1 has a remainder, a fairness warning is included in the result.
 */
export function runAssignAllDraw(
  teams: TournamentTeam[],
  participants: TournamentParticipant[],
): DrawResult {
  if (participants.length === 0) {
    return {
      teams,
      unassigned: teams.filter(t => !t.assignedTo),
      potBreakdown: new Map(),
      fairnessWarning: null,
    };
  }

  const n = participants.length;
  const result: TournamentTeam[] = teams.map(t => ({ ...t }));
  const pots = [...new Set(result.map(t => t.pot))].sort((a, b) => a - b);

  const potBreakdown = new Map<string, PotBreakdown>();
  for (const p of participants) potBreakdown.set(p.id, {});

  let pot1Uneven = false;

  for (const pot of pots) {
    const potTeams = shuffle(result.filter(t => t.pot === pot && !t.assignedTo));
    const base = Math.floor(potTeams.length / n);
    const rem = potTeams.length % n;

    if (pot === 1 && rem > 0) pot1Uneven = true;

    const order = shuffle([...participants]);
    let idx = 0;

    // Base assignment — every participant gets `base` teams from this pot
    for (const p of order) {
      for (let j = 0; j < base; j++) {
        const team = potTeams[idx++];
        const ri = result.findIndex(t => t.id === team.id);
        result[ri] = { ...result[ri], assignedTo: p.id };
        const bd = potBreakdown.get(p.id)!;
        bd[pot] = (bd[pot] ?? 0) + 1;
      }
    }

    // Remainder assignment — round-robin to the first `rem` participants in order
    for (let i = 0; i < rem; i++) {
      const team = potTeams[idx++];
      const p = order[i % n];
      const ri = result.findIndex(t => t.id === team.id);
      result[ri] = { ...result[ri], assignedTo: p.id };
      const bd = potBreakdown.get(p.id)!;
      bd[pot] = (bd[pot] ?? 0) + 1;
    }
  }

  return {
    teams: result,
    unassigned: [],
    potBreakdown,
    fairnessWarning: pot1Uneven
      ? 'Some participants received more Pot 1 teams than others. The draw assigned all teams.'
      : null,
  };
}
