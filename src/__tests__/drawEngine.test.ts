import { describe, it, expect } from 'vitest';
import {
  checkDrawFairness,
  runStrictFairSeededDraw,
  runAssignAllDraw,
} from '../lib/drawEngine';
import type { TournamentTeam, TournamentParticipant } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeParticipants(count: number): TournamentParticipant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    emoji: '👤',
    teamsCount: 0,
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

// ── checkDrawFairness ──────────────────────────────────────────────────────────

describe('checkDrawFairness', () => {
  it('reports no remainder when pots divide evenly', () => {
    const teams = makeTeams(9, 9); // 9 teams per pot, 9 participants → 1 each, 0 remainder
    const result = checkDrawFairness(teams, 9);
    expect(result.hasRemainder).toBe(false);
    expect(result.pot1Remainder).toBe(0);
    expect(result.strictUnassignedCount).toBe(0);
  });

  it('reports remainder when Pot 1 does not divide evenly', () => {
    const teams = makeTeams(12); // 12 Pot 1 teams, 9 participants → 1 each, 3 leftover
    const result = checkDrawFairness(teams, 9);
    expect(result.hasRemainder).toBe(true);
    expect(result.pot1Remainder).toBe(3); // 12 % 9 = 3
    expect(result.strictUnassignedCount).toBe(3);
  });

  it('returns zero values when participantCount is 0', () => {
    const result = checkDrawFairness(makeTeams(8), 0);
    expect(result.hasRemainder).toBe(false);
  });
});

// ── runStrictFairSeededDraw ────────────────────────────────────────────────────

describe('runStrictFairSeededDraw', () => {
  it('gives every participant exactly 1 Pot 1 team with 9 participants and 12 Pot 1 teams', () => {
    const participants = makeParticipants(9);
    const teams = makeTeams(12);
    const result = runStrictFairSeededDraw(teams, participants);

    for (const p of participants) {
      const pot1Count = result.teams.filter(
        t => t.assignedTo === p.id && t.pot === 1,
      ).length;
      expect(pot1Count).toBe(1);
    }
  });

  it('no participant gets 2 Pot 1 teams with 9 participants', () => {
    const participants = makeParticipants(9);
    const teams = makeTeams(12); // 12 Pot 1 teams → base=1, remainder=3
    const result = runStrictFairSeededDraw(teams, participants);

    for (const p of participants) {
      const pot1Count = result.teams.filter(
        t => t.assignedTo === p.id && t.pot === 1,
      ).length;
      expect(pot1Count).toBeLessThanOrEqual(1);
    }
  });

  it('leaves remainder Pot 1 teams unassigned', () => {
    const participants = makeParticipants(9);
    const teams = makeTeams(12); // 12 Pot 1 teams → 9 assigned, 3 unassigned
    const result = runStrictFairSeededDraw(teams, participants);

    const unassignedPot1 = result.unassigned.filter(t => t.pot === 1);
    expect(unassignedPot1.length).toBe(3);
  });

  it('assigns exactly floor(potSize/n) per participant per pot', () => {
    const participants = makeParticipants(4);
    const teams = makeTeams(9, 8); // Pot1: 9/4=2 each (1 leftover), Pot2: 8/4=2 each (0 leftover)
    const result = runStrictFairSeededDraw(teams, participants);

    for (const p of participants) {
      const p1 = result.teams.filter(t => t.assignedTo === p.id && t.pot === 1).length;
      const p2 = result.teams.filter(t => t.assignedTo === p.id && t.pot === 2).length;
      expect(p1).toBe(2);
      expect(p2).toBe(2);
    }
    expect(result.unassigned.filter(t => t.pot === 1).length).toBe(1);
  });

  it('produces no duplicate team assignments', () => {
    const participants = makeParticipants(5);
    const teams = makeTeams(10, 10);
    const result = runStrictFairSeededDraw(teams, participants);

    const assigned = result.teams.filter(t => t.assignedTo);
    const ids = assigned.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves all teams unassigned when no participants', () => {
    const teams = makeTeams(4);
    const result = runStrictFairSeededDraw(teams, []);
    expect(result.unassigned.length).toBe(4);
  });

  it('returns correct pot breakdown', () => {
    const participants = makeParticipants(3);
    const teams = makeTeams(6, 6); // 6/3=2 each per pot
    const result = runStrictFairSeededDraw(teams, participants);

    for (const p of participants) {
      const bd = result.potBreakdown.get(p.id);
      expect(bd?.[1]).toBe(2);
      expect(bd?.[2]).toBe(2);
    }
  });
});

// ── runAssignAllDraw ───────────────────────────────────────────────────────────

describe('runAssignAllDraw', () => {
  it('assigns every team', () => {
    const participants = makeParticipants(9);
    const teams = makeTeams(12, 9); // 12 Pot1 + 9 Pot2 = 21 teams
    const result = runAssignAllDraw(teams, participants);

    expect(result.unassigned.length).toBe(0);
    const assigned = result.teams.filter(t => t.assignedTo);
    expect(assigned.length).toBe(21);
  });

  it('sets fairness warning when Pot 1 has remainder', () => {
    const participants = makeParticipants(9);
    const teams = makeTeams(12); // 12 % 9 = 3 remainder in Pot 1
    const result = runAssignAllDraw(teams, participants);

    expect(result.fairnessWarning).not.toBeNull();
    expect(result.fairnessWarning).toContain('Pot 1');
  });

  it('does not set fairness warning when Pot 1 divides evenly', () => {
    const participants = makeParticipants(3);
    const teams = makeTeams(9, 5); // 9 % 3 = 0 Pot1 remainder; Pot2 has 2 remainder
    const result = runAssignAllDraw(teams, participants);

    expect(result.fairnessWarning).toBeNull();
  });

  it('produces no duplicate team assignments', () => {
    const participants = makeParticipants(7);
    const teams = makeTeams(16, 16);
    const result = runAssignAllDraw(teams, participants);

    const ids = result.teams.filter(t => t.assignedTo).map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns pot breakdown for all participants', () => {
    const participants = makeParticipants(3);
    const teams = makeTeams(9, 6);
    const result = runAssignAllDraw(teams, participants);

    let totalPot1 = 0;
    let totalPot2 = 0;
    for (const p of participants) {
      const bd = result.potBreakdown.get(p.id)!;
      totalPot1 += bd[1] ?? 0;
      totalPot2 += bd[2] ?? 0;
    }
    expect(totalPot1).toBe(9);
    expect(totalPot2).toBe(6);
  });
});
