import { describe, it, expect } from 'vitest';
import type { TournamentTeam, TournamentMatch, WorldCupMatch } from '../types';
import {
  isSameFixture,
  findResultOverride,
  resolveCanonicalScore,
  setResultOverride,
} from '../lib/resultOverrides';
import { buildEffectiveMatches } from '../lib/tournamentScoring';

const SCO = 9_000_500, HAI = 9_000_600;

function poolTeams(): TournamentTeam[] {
  return [
    { id: 't-sco', name: 'Scotland', pot: 3, status: 'active', providerTeamId: SCO, assignedTo: 'p1' },
    { id: 't-hai', name: 'Haiti', pot: 4, status: 'active', providerTeamId: HAI, assignedTo: 'p2' },
  ];
}

// Canonical (wrong) result: Scotland home 0–1 Haiti away
function wcm(overrides: Partial<WorldCupMatch> = {}): WorldCupMatch {
  return {
    providerMatchId: -4242, homeTeamId: SCO, awayTeamId: HAI,
    scoreHome: 0, scoreAway: 1, status: 'finished', stage: 'group', isManualOverride: false,
    ...overrides,
  };
}

describe('resultOverrides', () => {
  it('with no override, shows the canonical score as-is', () => {
    const s = resolveCanonicalScore(wcm(), undefined, poolTeams());
    expect(s).toMatchObject({ homeScore: 0, awayScore: 1, isManual: false });
  });

  it('setResultOverride stores a linked, scored override in canonical orientation', () => {
    const out = setResultOverride([], wcm(), poolTeams(), 1, 0); // Scotland 1–0 Haiti
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      teamAId: 't-sco', teamBId: 't-hai', scoreA: 1, scoreB: 0,
      providerMatchId: -4242, isManualOverride: true,
    });
  });

  it('display re-orients the override to the canonical home/away', () => {
    const matches = setResultOverride([], wcm(), poolTeams(), 1, 0);
    const ov = findResultOverride(matches, wcm(), poolTeams());
    const s = resolveCanonicalScore(wcm(), ov, poolTeams());
    expect(s).toMatchObject({ homeScore: 1, awayScore: 0, isManual: true });
  });

  it('replaces a prior correction instead of stacking', () => {
    let matches = setResultOverride([], wcm(), poolTeams(), 1, 0);
    matches = setResultOverride(matches, wcm(), poolTeams(), 2, 0); // re-correct
    expect(matches.filter(m => isSameFixture(m, wcm(), poolTeams()))).toHaveLength(1);
    expect(matches[0].scoreA).toBe(2);
  });

  it('matches a same-pairing override even without a providerMatchId link', () => {
    const manual: TournamentMatch = { id: 'x', teamAId: 't-hai', teamBId: 't-sco', scoreA: 0, scoreB: 1 };
    expect(isSameFixture(manual, wcm(), poolTeams())).toBe(true);
    const ov = findResultOverride([manual], wcm(), poolTeams());
    expect(ov).toBe(manual);
    // Haiti 0–1 Scotland re-oriented to canonical (Scotland home) → 1–0
    expect(resolveCanonicalScore(wcm(), ov, poolTeams())).toMatchObject({ homeScore: 1, awayScore: 0 });
  });

  it('the correction flips the win in scoring (Scotland now beats Haiti)', () => {
    const matches = setResultOverride([], wcm(), poolTeams(), 1, 0);
    const eff = buildEffectiveMatches(poolTeams(), matches, [wcm()], true);
    expect(eff).toHaveLength(1);
    // Scotland (t-sco) is teamA with the winning score
    const m = eff[0];
    const scoWon = (m.teamAId === 't-sco' && (m.scoreA ?? 0) > (m.scoreB ?? 0)) ||
                   (m.teamBId === 't-sco' && (m.scoreB ?? 0) > (m.scoreA ?? 0));
    expect(scoWon).toBe(true);
    expect(m.isManualOverride).toBe(true);
  });

  it('no-op when a team is not in the pool (cannot link the override)', () => {
    const out = setResultOverride([], wcm({ homeTeamId: 123456 }), poolTeams(), 1, 0);
    expect(out).toEqual([]);
  });
});
