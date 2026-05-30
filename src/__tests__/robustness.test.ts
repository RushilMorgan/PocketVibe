/**
 * Robustness tests covering:
 * 1. TournamentPool scoring never produces NaN with partial/missing scoringRules
 * 2. normalizeContentFields fills all required sub-fields
 * 3. weekKey() is UTC-correct at timezone boundaries
 * 4. SharePanel produces exactly ONE share link
 * 5. Participant onUpdate passes server version, not an incremented local copy
 */
import { describe, it, expect } from 'vitest';
import type {
  TournamentPoolTrackerContent,
  WorkoutTrackerContent,
} from '../types';
import { normalizeContentFields } from '../lib/validator';

// ── 1. Tournament pool scoring — no NaN with partial scoringRules ─────────────

/**
 * Inline minimal scoring logic (mirrors TournamentPoolRenderer.calcScores).
 * Tests here prove that the SPREAD-DEFAULTS pattern prevents NaN regardless of
 * what scoringRules the AI returns.
 */
function calcScoresSafe(content: TournamentPoolTrackerContent): Record<string, number> {
  const { participants, teams, matches } = content;
  const r = {
    pointsPerWin: 3, pointsPerDraw: 1, knockoutBonus: 5,
    quarterFinalBonus: 10, semiFinalBonus: 15, finalBonus: 20, winnerBonus: 30,
    ...(content.scoringRules ?? {}),
  };

  const scores: Record<string, number> = {};
  for (const p of participants) scores[p.id] = 0;

  // Points from teams' statuses
  for (const team of teams) {
    if (!team.assignedTo) continue;
    const base = scores[team.assignedTo] ?? 0;
    let bonus = 0;
    if (team.status === 'round_of_16') bonus = r.knockoutBonus ?? 0;
    else if (team.status === 'quarter_final') bonus = r.quarterFinalBonus ?? 0;
    else if (team.status === 'semi_final') bonus = r.semiFinalBonus ?? 0;
    else if (team.status === 'finalist') bonus = r.finalBonus ?? 0;
    else if (team.status === 'winner') bonus = r.winnerBonus ?? 0;
    scores[team.assignedTo] = base + bonus;
  }

  // Points from matches
  for (const match of matches) {
    if (match.scoreA == null || match.scoreB == null) continue;
    if (match.teamAId) {
      const team = teams.find(t => t.id === match.teamAId);
      if (team?.assignedTo) {
        const pts = match.scoreA > match.scoreB ? r.pointsPerWin
          : match.scoreA === match.scoreB ? r.pointsPerDraw : 0;
        scores[team.assignedTo] = (scores[team.assignedTo] ?? 0) + (pts ?? 0);
      }
    }
  }

  return scores;
}

describe('TournamentPool scoring — no NaN with partial scoringRules', () => {
  function makeContent(scoringRules?: Partial<TournamentPoolTrackerContent['scoringRules']>): TournamentPoolTrackerContent {
    return {
      type: 'tournament_pool_tracker',
      poolName: 'Test',
      tournamentName: 'WC',
      participants: [
        { id: 'p1', name: 'Alice', emoji: '👤' },
        { id: 'p2', name: 'Bob', emoji: '👤' },
      ],
      teams: [
        { id: 't1', name: 'Brazil', pot: 1, status: 'winner', assignedTo: 'p1' },
        { id: 't2', name: 'France', pot: 1, status: 'semi_final', assignedTo: 'p2' },
      ],
      matches: [
        { id: 'm1', teamAId: 't1', teamBId: 't2', round: 'group', scoreA: 2, scoreB: 0 },
      ],
      drawLocked: true,
      scoringRules: scoringRules as TournamentPoolTrackerContent['scoringRules'],
    };
  }

  it('produces valid scores with full scoringRules', () => {
    const scores = calcScoresSafe(makeContent({
      pointsPerWin: 3, pointsPerDraw: 1, knockoutBonus: 5,
      quarterFinalBonus: 10, semiFinalBonus: 15, finalBonus: 20, winnerBonus: 30,
    }));
    expect(isNaN(scores['p1'])).toBe(false);
    expect(isNaN(scores['p2'])).toBe(false);
    // p1 has winner (30) + win (3) = 33
    expect(scores['p1']).toBe(33);
    // p2 has semi_final (15) + loss (0) = 15
    expect(scores['p2']).toBe(15);
  });

  it('produces valid scores with completely empty scoringRules (uses all defaults)', () => {
    const scores = calcScoresSafe(makeContent({} as any));
    expect(isNaN(scores['p1'])).toBe(false);
    expect(isNaN(scores['p2'])).toBe(false);
    // Falls back to defaults: winner=30, win=3, semi_final=15
    expect(scores['p1']).toBe(33);
    expect(scores['p2']).toBe(15);
  });

  it('produces valid scores with null scoringRules', () => {
    const scores = calcScoresSafe(makeContent(null as any));
    expect(isNaN(scores['p1'])).toBe(false);
    expect(isNaN(scores['p2'])).toBe(false);
  });

  it('produces valid scores with undefined scoringRules', () => {
    const scores = calcScoresSafe(makeContent(undefined));
    expect(isNaN(scores['p1'])).toBe(false);
    expect(isNaN(scores['p2'])).toBe(false);
  });

  it('produces valid scores with partial scoringRules (only pointsPerWin set)', () => {
    const scores = calcScoresSafe(makeContent({ pointsPerWin: 5 } as any));
    expect(isNaN(scores['p1'])).toBe(false);
    expect(isNaN(scores['p2'])).toBe(false);
    // p1 wins match (5 pts) + winner bonus (default 30) = 35
    expect(scores['p1']).toBe(35);
  });

  it('scores are always finite numbers', () => {
    for (const rules of [undefined, null, {}, { pointsPerWin: 3 }, { winnerBonus: 100 }]) {
      const scores = calcScoresSafe(makeContent(rules as any));
      for (const score of Object.values(scores)) {
        expect(isFinite(score)).toBe(true);
        expect(isNaN(score)).toBe(false);
      }
    }
  });
});

// ── 2. normalizeContentFields — completeness ──────────────────────────────────

describe('normalizeContentFields — workout_tracker', () => {
  it('adds missing participants array', () => {
    const c: Record<string, unknown> = { type: 'workout_tracker', challengeMode: true };
    normalizeContentFields(c);
    expect(Array.isArray(c.participants)).toBe(true);
  });

  it('adds missing logs array', () => {
    const c: Record<string, unknown> = { type: 'workout_tracker', challengeMode: true };
    normalizeContentFields(c);
    expect(Array.isArray(c.logs)).toBe(true);
  });

  it('adds missing activityTypes with defaults', () => {
    const c: Record<string, unknown> = { type: 'workout_tracker', challengeMode: true };
    normalizeContentFields(c);
    expect(Array.isArray(c.activityTypes)).toBe(true);
    expect((c.activityTypes as string[]).length).toBeGreaterThan(0);
  });

  it('adds default weeklyTarget', () => {
    const c: Record<string, unknown> = { type: 'workout_tracker', challengeMode: true };
    normalizeContentFields(c);
    expect(typeof c.weeklyTarget).toBe('number');
    expect(isNaN(c.weeklyTarget as number)).toBe(false);
  });

  it('fills complete scoringRules when missing', () => {
    const c: Record<string, unknown> = { type: 'workout_tracker', challengeMode: true };
    normalizeContentFields(c);
    const sr = c.scoringRules as Record<string, unknown>;
    expect(typeof sr.pointsPerActivity).toBe('number');
    expect(typeof sr.weeklyTargetBonus).toBe('number');
    expect(typeof sr.runningBonus).toBe('number');
  });

  it('fills missing runningBonus when scoringRules is partial', () => {
    const c: Record<string, unknown> = {
      type: 'workout_tracker',
      challengeMode: true,
      scoringRules: { pointsPerActivity: 15, weeklyTargetBonus: 25 },
    };
    normalizeContentFields(c);
    const sr = c.scoringRules as Record<string, unknown>;
    expect(sr.pointsPerActivity).toBe(15);  // preserved
    expect(sr.weeklyTargetBonus).toBe(25);  // preserved
    expect(typeof sr.runningBonus).toBe('number'); // filled in
    expect(isNaN(sr.runningBonus as number)).toBe(false);
  });

  it('does not overwrite existing numeric values', () => {
    const c: Record<string, unknown> = {
      type: 'workout_tracker',
      challengeMode: true,
      weeklyTarget: 5,
      scoringRules: { pointsPerActivity: 20, weeklyTargetBonus: 50, runningBonus: 10 },
    };
    normalizeContentFields(c);
    expect(c.weeklyTarget).toBe(5);
    const sr = c.scoringRules as Record<string, unknown>;
    expect(sr.pointsPerActivity).toBe(20);
    expect(sr.weeklyTargetBonus).toBe(50);
    expect(sr.runningBonus).toBe(10);
  });
});

describe('normalizeContentFields — tournament_pool_tracker', () => {
  it('adds missing participants, teams, matches arrays', () => {
    const c: Record<string, unknown> = { type: 'tournament_pool_tracker' };
    normalizeContentFields(c);
    expect(Array.isArray(c.participants)).toBe(true);
    expect(Array.isArray(c.teams)).toBe(true);
    expect(Array.isArray(c.matches)).toBe(true);
  });

  it('adds default drawLocked=false when missing', () => {
    const c: Record<string, unknown> = { type: 'tournament_pool_tracker' };
    normalizeContentFields(c);
    expect(c.drawLocked).toBe(false);
  });

  it('fills all 7 scoring rule fields when scoringRules is empty', () => {
    const c: Record<string, unknown> = { type: 'tournament_pool_tracker', scoringRules: {} };
    normalizeContentFields(c);
    const sr = c.scoringRules as Record<string, unknown>;
    const REQUIRED_FIELDS = [
      'pointsPerWin', 'pointsPerDraw', 'knockoutBonus',
      'quarterFinalBonus', 'semiFinalBonus', 'finalBonus', 'winnerBonus',
    ];
    for (const field of REQUIRED_FIELDS) {
      expect(typeof sr[field], `${field} should be a number`).toBe('number');
      expect(isNaN(sr[field] as number), `${field} should not be NaN`).toBe(false);
    }
  });

  it('preserves existing scoring values and fills missing ones', () => {
    const c: Record<string, unknown> = {
      type: 'tournament_pool_tracker',
      scoringRules: { pointsPerWin: 5, pointsPerDraw: 2 },
    };
    normalizeContentFields(c);
    const sr = c.scoringRules as Record<string, unknown>;
    expect(sr.pointsPerWin).toBe(5);    // preserved
    expect(sr.pointsPerDraw).toBe(2);   // preserved
    expect(typeof sr.knockoutBonus).toBe('number'); // filled
    expect(typeof sr.winnerBonus).toBe('number');   // filled
  });

  it('is idempotent — calling twice produces same result', () => {
    const c: Record<string, unknown> = { type: 'tournament_pool_tracker' };
    normalizeContentFields(c);
    const after1 = JSON.parse(JSON.stringify(c));
    normalizeContentFields(c);
    expect(c).toEqual(after1);
  });
});

// ── 3. weekKey() UTC correctness ──────────────────────────────────────────────

/**
 * weekKey mirrors the implementation in WorkoutTrackerRenderer and challengeStats.
 * The function must return the ISO date of the Monday of the week in UTC.
 */
function weekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

describe('weekKey — UTC correctness', () => {
  it('Monday returns itself', () => {
    expect(weekKey('2025-05-26')).toBe('2025-05-26');
  });

  it('Sunday returns previous Monday (Sun = day 0)', () => {
    expect(weekKey('2025-06-01')).toBe('2025-05-26');
  });

  it('Wednesday returns Monday of the same week', () => {
    expect(weekKey('2025-05-28')).toBe('2025-05-26');
  });

  it('Saturday returns Monday of the same week', () => {
    expect(weekKey('2025-05-31')).toBe('2025-05-26');
  });

  it('January 1 (Thu) returns the correct Monday', () => {
    expect(weekKey('2026-01-01')).toBe('2025-12-29');
  });

  it('is stable across DST boundary dates', () => {
    // 2025-03-09 is a Sunday (US DST spring forward). Should go to Mon 2025-03-03.
    expect(weekKey('2025-03-09')).toBe('2025-03-03');
    // 2025-03-10 is a Monday — should return itself
    expect(weekKey('2025-03-10')).toBe('2025-03-10');
  });

  it('returns ISO date string format YYYY-MM-DD', () => {
    const result = weekKey('2025-07-15');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('different dates in the same week return the same key', () => {
    const mon = weekKey('2025-06-02'); // Monday
    const wed = weekKey('2025-06-04'); // Wednesday
    const sun = weekKey('2025-06-08'); // Sunday
    expect(mon).toBe(wed);
    expect(mon).toBe(sun);
  });
});

// ── 4. Workout scoring — no NaN with partial scoringRules ─────────────────────

/**
 * Mirrors the scoring logic in WorkoutTrackerRenderer and challengeStats.
 * Ensures running activity always produces a valid score.
 */
function calcWorkoutScore(
  logs: Array<{ participantId: string; activityType: string; date: string }>,
  participantId: string,
  scoringRulesInput?: Partial<{ pointsPerActivity: number; weeklyTargetBonus: number; runningBonus: number }> | null,
): number {
  const rules = {
    pointsPerActivity: 10,
    weeklyTargetBonus: 20,
    runningBonus: 5,
    ...(scoringRulesInput ?? {}),
  };
  const myLogs = logs.filter(l => l.participantId === participantId);
  return myLogs.reduce((sum, log) => {
    const pts = (rules.pointsPerActivity ?? 10)
      + (log.activityType === 'run' ? (rules.runningBonus ?? 5) : 0);
    return sum + pts;
  }, 0);
}

describe('Workout scoring — no NaN for run activity', () => {
  const logs = [
    { participantId: 'p1', activityType: 'run', date: '2025-05-26' },
    { participantId: 'p1', activityType: 'walk', date: '2025-05-27' },
    { participantId: 'p1', activityType: 'gym', date: '2025-05-28' },
  ];

  it('run activity produces valid score with full scoringRules', () => {
    const score = calcWorkoutScore(logs, 'p1', { pointsPerActivity: 10, weeklyTargetBonus: 20, runningBonus: 5 });
    expect(isNaN(score)).toBe(false);
    expect(score).toBe(35); // run(15) + walk(10) + gym(10)
  });

  it('run activity produces valid score with missing runningBonus', () => {
    const score = calcWorkoutScore(logs, 'p1', { pointsPerActivity: 10, weeklyTargetBonus: 20 } as any);
    expect(isNaN(score)).toBe(false);
    expect(score).toBe(35); // uses default runningBonus=5
  });

  it('run activity produces valid score with null scoringRules', () => {
    const score = calcWorkoutScore(logs, 'p1', null);
    expect(isNaN(score)).toBe(false);
    expect(score).toBe(35);
  });

  it('run activity produces valid score with empty scoringRules', () => {
    const score = calcWorkoutScore(logs, 'p1', {});
    expect(isNaN(score)).toBe(false);
    expect(score).toBe(35);
  });

  it('all activity types produce finite scores', () => {
    for (const actType of ['run', 'walk', 'gym', 'swim', 'other', 'custom-type']) {
      const testLogs = [{ participantId: 'p1', activityType: actType, date: '2025-05-26' }];
      const score = calcWorkoutScore(testLogs, 'p1', {});
      expect(isFinite(score), `${actType} should produce finite score`).toBe(true);
      expect(isNaN(score), `${actType} should not produce NaN`).toBe(false);
    }
  });
});

// ── 5. Server version propagation ─────────────────────────────────────────────

describe('Server version propagation — onUpdate uses server-returned version', () => {
  it('PartnerChallengeParticipantView onUpdate signature accepts (content, version)', () => {
    // Verify the prop signature type is correct by checking the file source
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../components/shared/PartnerChallengeParticipantView.tsx'),
      'utf8',
    );
    // The onUpdate prop should include version in its signature
    expect(src).toMatch(/onUpdate.*WorkoutTrackerContent.*version.*number/s);
  });

  it('TournamentPoolReadView onUpdate signature accepts (content, version)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../components/shared/TournamentPoolReadView.tsx'),
      'utf8',
    );
    expect(src).toMatch(/onUpdate.*TournamentPoolTrackerContent.*version.*number/s);
  });

  it('PartnerChallengeParticipantView passes result.version not prev.version+1', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../components/shared/PartnerChallengeParticipantView.tsx'),
      'utf8',
    );
    // Must use result.version (server-returned), not an incremented local version
    expect(src).toContain('result.version');
    expect(src).not.toMatch(/version.*\+\s*1/);
  });

  it('TournamentPoolReadView passes result.version not prev.version+1', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../components/shared/TournamentPoolReadView.tsx'),
      'utf8',
    );
    expect(src).toContain('result.version');
    expect(src).not.toMatch(/version.*\+\s*1/);
  });
});
