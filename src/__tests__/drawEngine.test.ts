import { describe, it, expect } from 'vitest';
import { runFairSeededDraw, shuffle, teamStrength } from '../lib/drawEngine';
import type { TournamentTeam, TournamentParticipant } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeParticipants(count: number): TournamentParticipant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    emoji: '👤',
  }));
}

function makeTeams(pot1Count: number, pot2Count = 0, pot3Count = 0, pot4Count = 0): TournamentTeam[] {
  const teams: TournamentTeam[] = [];
  let id = 1;
  const add = (pot: number, count: number) => {
    for (let i = 0; i < count; i++) {
      teams.push({ id: `t${id++}`, name: `Team ${id - 1}`, pot, status: 'active' });
    }
  };
  add(1, pot1Count);
  add(2, pot2Count);
  add(3, pot3Count);
  add(4, pot4Count);
  return teams;
}

// ── shuffle ────────────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('returns all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate original', () => {
    const arr = [1, 2, 3];
    shuffle(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});

// ── teamStrength ───────────────────────────────────────────────────────────────

describe('teamStrength', () => {
  it('Pot 1 > Pot 2 > Pot 3 > Pot 4', () => {
    const s = (pot: number) => teamStrength({ id: 't', name: 'T', pot, status: 'active' });
    expect(s(1)).toBeGreaterThan(s(2));
    expect(s(2)).toBeGreaterThan(s(3));
    expect(s(3)).toBeGreaterThan(s(4));
  });

  it('uses strengthScore if set', () => {
    const team: TournamentTeam = { id: 't', name: 'T', pot: 4, status: 'active', strengthScore: 999 };
    expect(teamStrength(team)).toBe(999);
  });

  it('lower fifa rank = higher score within same pot', () => {
    const strong: TournamentTeam = { id: 'a', name: 'A', pot: 2, status: 'active', fifaRank: 1 };
    const weak: TournamentTeam = { id: 'b', name: 'B', pot: 2, status: 'active', fifaRank: 50 };
    expect(teamStrength(strong)).toBeGreaterThan(teamStrength(weak));
  });
});

// ── runFairSeededDraw ──────────────────────────────────────────────────────────

describe('runFairSeededDraw — all teams assigned', () => {
  it('assigns every team (9 participants, 48 teams)', () => {
    const participants = makeParticipants(9);
    const teams = makeTeams(12, 12, 12, 12); // 48 total
    const result = runFairSeededDraw(teams, participants);

    expect(result.unassigned.length).toBe(0);
    const assigned = result.teams.filter(t => t.assignedTo);
    expect(assigned.length).toBe(48);
  });

  it('no unassigned teams remain after draw', () => {
    const participants = makeParticipants(7);
    const teams = makeTeams(12, 12, 10, 8);
    const result = runFairSeededDraw(teams, participants);
    expect(result.unassigned.length).toBe(0);
    expect(result.teams.every(t => t.assignedTo != null)).toBe(true);
  });

  it('no duplicate team assignments', () => {
    const participants = makeParticipants(9);
    const teams = makeTeams(12, 12, 12, 12);
    const result = runFairSeededDraw(teams, participants);

    const ids = result.teams.map(t => t.assignedTo!);
    // Each team id appears exactly once; verify by checking all are assigned
    const teamIds = result.teams.map(t => t.id);
    expect(new Set(teamIds).size).toBe(teamIds.length);
    expect(ids.every(id => id != null)).toBe(true);
  });

  it('returns empty unassigned array (never a bonus pool)', () => {
    const participants = makeParticipants(5);
    const teams = makeTeams(10, 9, 8, 7);
    const result = runFairSeededDraw(teams, participants);
    expect(result.unassigned).toHaveLength(0);
  });
});

describe('runFairSeededDraw — Pot 1 distribution', () => {
  it('with 9 participants and 12 Pot 1 teams, Pot 1 count differs by at most 1', () => {
    const participants = makeParticipants(9);
    const teams = makeTeams(12);
    const result = runFairSeededDraw(teams, participants);

    const pot1Counts = participants.map(p =>
      result.teams.filter(t => t.assignedTo === p.id && t.pot === 1).length,
    );
    const min = Math.min(...pot1Counts);
    const max = Math.max(...pot1Counts);
    expect(max - min).toBeLessThanOrEqual(1);
  });

  it('with 9 participants and 9 Pot 1 teams, every participant gets exactly 1', () => {
    const participants = makeParticipants(9);
    const teams = makeTeams(9, 9, 9, 9);
    const result = runFairSeededDraw(teams, participants);

    for (const p of participants) {
      const count = result.teams.filter(t => t.assignedTo === p.id && t.pot === 1).length;
      expect(count).toBe(1);
    }
  });

  it('sets fairness warning when Pot 1 cannot divide evenly', () => {
    const result = runFairSeededDraw(makeTeams(12), makeParticipants(9));
    expect(result.fairnessWarning).not.toBeNull();
    expect(result.fairnessWarning).toContain('Toolie balanced');
  });

  it('no fairness warning when Pot 1 divides evenly', () => {
    const result = runFairSeededDraw(makeTeams(9, 9, 9, 9), makeParticipants(9));
    expect(result.fairnessWarning).toBeNull();
  });
});

describe('runFairSeededDraw — strength balancing', () => {
  it('participants with extra Pot 1 teams receive weaker lower-pot allocation overall', () => {
    // 3 participants, 4 Pot 1 teams → one participant gets 2 Pot 1, others get 1 each
    const participants = makeParticipants(3);
    // Give Pot 1 teams explicit high strength, Pot 2 explicit lower
    const pot1Teams: TournamentTeam[] = Array.from({ length: 4 }, (_, i) => ({
      id: `p1t${i}`, name: `P1T${i}`, pot: 1, status: 'active' as const, strengthScore: 400,
    }));
    const pot2Teams: TournamentTeam[] = Array.from({ length: 3 }, (_, i) => ({
      id: `p2t${i}`, name: `P2T${i}`, pot: 2, status: 'active' as const, strengthScore: 100 * (3 - i), // 300, 200, 100
    }));
    const teams = [...pot1Teams, ...pot2Teams];
    const result = runFairSeededDraw(teams, participants);

    // Find the participant who received 2 Pot 1 teams
    const extra = participants.find(p =>
      result.teams.filter(t => t.assignedTo === p.id && t.pot === 1).length === 2,
    );
    expect(extra).toBeDefined();

    // That participant's Pot 2 team should be the weakest one (strengthScore = 100)
    const extraPot2 = result.teams.find(t => t.assignedTo === extra!.id && t.pot === 2);
    expect(extraPot2?.strengthScore).toBe(100);
  });

  it('strength gap between strongest and weakest participant is smaller than naive worst-case', () => {
    // Fair draw should produce less strength variance than purely random.
    // With 12 Pot1 (strength ~499), 12 Pot2 (~399), 12 Pot3 (~299), 12 Pot4 (~199) among 9 participants:
    // Worst case: one participant gets all Pot 1, another gets all Pot 4. Gap would be enormous.
    // Fair draw: gap should be well under 2000 (avg strength per participant is ~240*48/9 ≈ 1280).
    const participants = makeParticipants(9);
    const teams: TournamentTeam[] = [
      ...Array.from({ length: 12 }, (_, i) => ({ id: `p1t${i}`, name: `P1T${i}`, pot: 1, status: 'active' as const, fifaRank: i + 1 })),
      ...Array.from({ length: 12 }, (_, i) => ({ id: `p2t${i}`, name: `P2T${i}`, pot: 2, status: 'active' as const, fifaRank: i + 10 })),
      ...Array.from({ length: 12 }, (_, i) => ({ id: `p3t${i}`, name: `P3T${i}`, pot: 3, status: 'active' as const, fifaRank: i + 20 })),
      ...Array.from({ length: 12 }, (_, i) => ({ id: `p4t${i}`, name: `P4T${i}`, pot: 4, status: 'active' as const, fifaRank: i + 60 })),
    ];
    const result = runFairSeededDraw(teams, participants);
    const strengths = participants.map(p => result.participantSummaries.get(p.id)!.strengthScore);
    const gap = Math.max(...strengths) - Math.min(...strengths);
    // Max theoretical gap if perfectly balanced: ~600 (difference of one Pot 1 team vs one Pot 4 team).
    // In practice the balancing keeps it tighter. Threshold: 1000.
    expect(gap).toBeLessThan(1000);
  });

  it('total teams per participant differs by at most 1', () => {
    const participants = makeParticipants(9);
    const teams = makeTeams(12, 12, 12, 12); // 48 total, 48/9 = 5r3
    const result = runFairSeededDraw(teams, participants);

    const counts = participants.map(p => result.teams.filter(t => t.assignedTo === p.id).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});

describe('runFairSeededDraw — pot breakdown', () => {
  it('draw summary includes pot counts per participant', () => {
    const participants = makeParticipants(3);
    const teams = makeTeams(6, 6); // 6/3 = 2 each per pot, no remainder
    const result = runFairSeededDraw(teams, participants);

    for (const p of participants) {
      const bd = result.potBreakdown.get(p.id);
      expect((bd?.[1] ?? 0) + (bd?.[2] ?? 0)).toBe(4); // 2+2
    }
  });

  it('participantSummaries contains strength and team count', () => {
    const participants = makeParticipants(4);
    const teams = makeTeams(8, 8);
    const result = runFairSeededDraw(teams, participants);

    for (const p of participants) {
      const summary = result.participantSummaries.get(p.id);
      expect(summary).toBeDefined();
      expect(summary!.totalTeams).toBe(4);
      expect(summary!.strengthScore).toBeGreaterThan(0);
    }
  });
});

describe('runFairSeededDraw — edge cases', () => {
  it('returns unassigned teams when no participants', () => {
    const teams = makeTeams(4, 4);
    const result = runFairSeededDraw(teams, []);
    expect(result.unassigned.length).toBe(8);
    expect(result.teams.every(t => !t.assignedTo)).toBe(true);
  });

  it('single participant receives all teams', () => {
    const teams = makeTeams(3, 3);
    const result = runFairSeededDraw(teams, makeParticipants(1));
    expect(result.teams.every(t => t.assignedTo === 'p1')).toBe(true);
  });

  it('only one draw action exists — no strict_fair_seeded or assign_all_teams exports', async () => {
    // The new API only exports runFairSeededDraw, not the old multi-mode functions
    const mod = await import('../lib/drawEngine');
    expect(typeof mod.runFairSeededDraw).toBe('function');
    expect((mod as Record<string, unknown>).runStrictFairSeededDraw).toBeUndefined();
    expect((mod as Record<string, unknown>).runAssignAllDraw).toBeUndefined();
  });
});
