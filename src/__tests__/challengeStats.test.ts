/**
 * Tests for the pure challengeStats functions.
 * Covers the 8 core requirements from the Partner Challenge long-term tracker spec.
 */
import { describe, it, expect } from 'vitest';
import {
  getCurrentWeekStats,
  getPastWeeks,
  getMonthStats,
  getAllTimeStats,
  countBothHitTarget,
} from '../lib/challengeStats';
import type { ActivityLog, ChallengeScoringRules } from '../types';
import { tryApplyLocalUpdate } from '../lib/localUpdater';
import type { WorkoutTrackerContent } from '../types';

const RULES: ChallengeScoringRules = {
  pointsPerActivity: 10,
  weeklyTargetBonus: 20,
  runningBonus: 5,
};

// Monday 12 May 2025 → week key "2025-05-12"
// Monday 19 May 2025 → week key "2025-05-19"
// Monday 26 May 2025 → week key "2025-05-26"
const THIS_WEEK_MON = '2025-05-26'; // "today" for all tests
const TODAY = '2025-05-28'; // Wednesday in the current week

function makeLog(
  id: string,
  participantId: string,
  date: string,
  activityType: ActivityLog['activityType'] = 'walk',
): ActivityLog {
  return { id, participantId, date, activityType };
}

// ── Test 1: Activity logs are preserved across weeks ─────────────────────────

describe('challengeStats — activity logs preserved across weeks', () => {
  it('getPastWeeks returns data for logs from previous weeks', () => {
    const logs: ActivityLog[] = [
      makeLog('l1', 'p1', '2025-05-20', 'walk'), // week of 2025-05-19
      makeLog('l2', 'p1', '2025-05-21', 'run'),  // same week
      makeLog('l3', 'p1', '2025-05-22', 'walk'), // same week — 3 sessions → hits target
      makeLog('l4', 'p1', '2025-05-13', 'walk'), // week of 2025-05-12
    ];
    const pastWeeks = getPastWeeks('p1', logs, RULES, 3, TODAY);
    // Two distinct past weeks present
    expect(pastWeeks.length).toBe(2);
    // Most recent past week first
    expect(pastWeeks[0].weekStart).toBe('2025-05-19');
    expect(pastWeeks[0].sessions).toBe(3);
    expect(pastWeeks[0].hitTarget).toBe(true);
    // Older week
    expect(pastWeeks[1].weekStart).toBe('2025-05-12');
    expect(pastWeeks[1].sessions).toBe(1);
    expect(pastWeeks[1].hitTarget).toBe(false);
  });

  it('current-week logs are never included in past weeks', () => {
    const logs: ActivityLog[] = [
      makeLog('l1', 'p1', TODAY, 'walk'), // current week
      makeLog('l2', 'p1', '2025-05-20', 'walk'), // past week
    ];
    const pastWeeks = getPastWeeks('p1', logs, RULES, 3, TODAY);
    expect(pastWeeks.every(w => w.weekStart < THIS_WEEK_MON)).toBe(true);
  });
});

// ── Test 2: Current week progress is calculated from logs ────────────────────

describe('challengeStats — current week progress from logs', () => {
  it('returns correct session count for the current week only', () => {
    const logs: ActivityLog[] = [
      makeLog('l1', 'p1', TODAY, 'walk'),         // this week
      makeLog('l2', 'p1', '2025-05-26', 'run'),   // this week (Monday)
      makeLog('l3', 'p1', '2025-05-20', 'walk'),  // last week — must NOT count
    ];
    const stats = getCurrentWeekStats('p1', logs, RULES, 3, TODAY);
    expect(stats.sessions).toBe(2);
    expect(stats.hitTarget).toBe(false);
  });

  it('marks hitTarget true when sessions >= weeklyTarget', () => {
    const logs: ActivityLog[] = [
      makeLog('l1', 'p1', '2025-05-26', 'walk'),
      makeLog('l2', 'p1', '2025-05-27', 'run'),
      makeLog('l3', 'p1', TODAY, 'gym'),
    ];
    const stats = getCurrentWeekStats('p1', logs, RULES, 3, TODAY);
    expect(stats.sessions).toBe(3);
    expect(stats.hitTarget).toBe(true);
    // Points: 3×10 + 5 (run) + 20 (weekly bonus) = 55
    expect(stats.points).toBe(55);
  });
});

// ── Test 3: Monthly totals are calculated from logs ──────────────────────────

describe('challengeStats — monthly totals from logs', () => {
  it('getMonthStats counts only logs within the given month', () => {
    const logs: ActivityLog[] = [
      makeLog('l1', 'p1', '2025-05-01', 'walk'),
      makeLog('l2', 'p1', '2025-05-15', 'run'),
      makeLog('l3', 'p1', '2025-05-22', 'walk'),
      makeLog('l4', 'p1', '2025-04-30', 'walk'), // April — must NOT count
    ];
    const ms = getMonthStats('p1', logs, RULES, 3, 2025, 4); // month 4 = May
    expect(ms.sessions).toBe(3);
    expect(ms.year).toBe(2025);
    expect(ms.month).toBe(4);
  });

  it('monthly points include weekly target bonuses when earned', () => {
    // weeks of 2025-05-12 and 2025-05-19 are in May
    const logs: ActivityLog[] = [
      makeLog('l1', 'p1', '2025-05-13', 'walk'),
      makeLog('l2', 'p1', '2025-05-14', 'walk'),
      makeLog('l3', 'p1', '2025-05-15', 'walk'), // 3 sessions in week of May 12 → hits target
    ];
    const ms = getMonthStats('p1', logs, RULES, 3, 2025, 4);
    expect(ms.weeksHitTarget).toBe(1);
    // 3×10 + 20 bonus = 50
    expect(ms.points).toBe(50);
  });
});

// ── Test 4: All-time totals are calculated from logs ─────────────────────────

describe('challengeStats — all-time totals from logs', () => {
  it('getAllTimeStats sums all sessions and points across all time', () => {
    const logs: ActivityLog[] = [
      makeLog('l1', 'p1', '2025-04-07', 'walk'),
      makeLog('l2', 'p1', '2025-04-08', 'run'),
      makeLog('l3', 'p1', '2025-04-09', 'walk'),
      makeLog('l4', 'p1', '2025-04-10', 'gym'),
      makeLog('l5', 'p1', '2025-04-11', 'walk'), // 5 sessions in week of Apr 7 → hits target
      makeLog('l6', 'p2', '2025-04-07', 'walk'), // different participant — must NOT count
    ];
    const at = getAllTimeStats('p1', logs, RULES, 3, TODAY);
    expect(at.sessions).toBe(5);
    // 5×10 + 5 (run) + 20 (weekly bonus) = 75
    expect(at.points).toBe(75);
    expect(at.bestWeekSessions).toBe(5);
  });

  it('currentStreak counts consecutive past weeks hitting target', () => {
    const logs: ActivityLog[] = [
      // week of 2025-05-05 — 3 sessions (hits target)
      makeLog('l1', 'p1', '2025-05-05', 'walk'),
      makeLog('l2', 'p1', '2025-05-06', 'walk'),
      makeLog('l3', 'p1', '2025-05-07', 'walk'),
      // week of 2025-05-12 — 3 sessions (hits target)
      makeLog('l4', 'p1', '2025-05-12', 'walk'),
      makeLog('l5', 'p1', '2025-05-13', 'walk'),
      makeLog('l6', 'p1', '2025-05-14', 'walk'),
      // week of 2025-05-19 — 3 sessions (hits target)
      makeLog('l7', 'p1', '2025-05-19', 'walk'),
      makeLog('l8', 'p1', '2025-05-20', 'walk'),
      makeLog('l9', 'p1', '2025-05-21', 'walk'),
    ];
    const at = getAllTimeStats('p1', logs, RULES, 3, TODAY);
    expect(at.currentStreak).toBe(3);
    expect(at.longestStreak).toBe(3);
  });
});

// ── Test 5: Changing weekly target does NOT delete logs ───────────────────────

describe('Partner Challenge — changing settings preserves logs', () => {
  function makeWorkoutContent(overrides: Partial<WorkoutTrackerContent> = {}): WorkoutTrackerContent {
    return {
      type: 'workout_tracker',
      planName: 'Test Challenge',
      challengeMode: true,
      participants: [
        { id: 'p1', name: 'Alice', emoji: '🏃' },
        { id: 'p2', name: 'Bob', emoji: '🚶' },
      ],
      activityTypes: ['walk', 'run', 'gym', 'other'],
      weeklyTarget: 3,
      logs: [
        makeLog('l1', 'p1', '2025-05-01', 'walk'),
        makeLog('l2', 'p1', '2025-05-08', 'run'),
        makeLog('l3', 'p2', '2025-05-01', 'gym'),
      ],
      scoringRules: RULES,
      ...overrides,
    };
  }

  it('changing weekly target preserves all activity logs', () => {
    const creation = {
      id: 'c1',
      title: 'My Challenge',
      description: '',
      summary: '',
      originalRequest: '',
      status: 'ready' as const,
      version: 1,
      createdAt: 0,
      updatedAt: 0,
      creationType: 'workout_tracker' as const,
      content: makeWorkoutContent(),
    };
    const result = tryApplyLocalUpdate('make weekly target 4', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.weeklyTarget).toBe(4);
    expect(updated.logs).toHaveLength(3);
    expect(updated.logs?.map(l => l.id)).toEqual(['l1', 'l2', 'l3']);
  });

  it('changing scoring rules preserves all activity logs', () => {
    const creation = {
      id: 'c1',
      title: 'My Challenge',
      description: '',
      summary: '',
      originalRequest: '',
      status: 'ready' as const,
      version: 1,
      createdAt: 0,
      updatedAt: 0,
      creationType: 'workout_tracker' as const,
      content: makeWorkoutContent(),
    };
    const result = tryApplyLocalUpdate('set points per activity to 15', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.scoringRules?.pointsPerActivity).toBe(15);
    expect(updated.logs).toHaveLength(3);
  });
});

// ── Test 6: Changing scoring rules recalculates scores ───────────────────────

describe('challengeStats — changing scoring rules recalculates correctly', () => {
  it('getAllTimeStats respects updated pointsPerActivity', () => {
    const logs: ActivityLog[] = [
      makeLog('l1', 'p1', '2025-05-01', 'walk'),
      makeLog('l2', 'p1', '2025-05-02', 'walk'),
    ];
    const lowRules: ChallengeScoringRules = { ...RULES, pointsPerActivity: 5 };
    const highRules: ChallengeScoringRules = { ...RULES, pointsPerActivity: 20 };
    const atLow = getAllTimeStats('p1', logs, lowRules, 3, TODAY);
    const atHigh = getAllTimeStats('p1', logs, highRules, 3, TODAY);
    expect(atHigh.points).toBeGreaterThan(atLow.points);
    expect(atLow.points).toBe(10); // 2×5
    expect(atHigh.points).toBe(40); // 2×20
  });
});

// ── Test 7: Chat command "make weekly target 4" updates target ────────────────

describe('localUpdater — chat command: make weekly target 4', () => {
  function makeCreation(logs: ActivityLog[] = []): Parameters<typeof tryApplyLocalUpdate>[1] {
    return {
      id: 'c1',
      title: 'My Challenge',
      description: '',
      summary: '',
      originalRequest: '',
      status: 'ready' as const,
      version: 1,
      createdAt: 0,
      updatedAt: 0,
      creationType: 'workout_tracker' as const,
      content: {
        type: 'workout_tracker',
        planName: 'My Challenge',
        challengeMode: true,
        participants: [{ id: 'p1', name: 'Alice', emoji: '🏃' }],
        activityTypes: ['walk', 'run'],
        weeklyTarget: 3,
        logs,
        scoringRules: RULES,
      } as WorkoutTrackerContent,
    };
  }

  it('sets weeklyTarget to 4', () => {
    const result = tryApplyLocalUpdate('make weekly target 4', makeCreation());
    expect(result.handled).toBe(true);
    expect((result.updatedContent as WorkoutTrackerContent).weeklyTarget).toBe(4);
  });

  it('preserves all existing logs', () => {
    const existingLogs: ActivityLog[] = [
      makeLog('l1', 'p1', '2025-05-01', 'walk'),
      makeLog('l2', 'p1', '2025-05-08', 'run'),
    ];
    const result = tryApplyLocalUpdate('make weekly target 4', makeCreation(existingLogs));
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.logs).toHaveLength(2);
    expect(updated.logs?.map(l => l.id)).toEqual(['l1', 'l2']);
  });
});

// ── Test 8: Chat command "add gym activity" adds type and preserves history ───

describe('localUpdater — chat command: add gym activity', () => {
  function makeCreation(activityTypes: string[] = ['walk', 'run'], logs: ActivityLog[] = []): Parameters<typeof tryApplyLocalUpdate>[1] {
    return {
      id: 'c1',
      title: 'My Challenge',
      description: '',
      summary: '',
      originalRequest: '',
      status: 'ready' as const,
      version: 1,
      createdAt: 0,
      updatedAt: 0,
      creationType: 'workout_tracker' as const,
      content: {
        type: 'workout_tracker',
        planName: 'My Challenge',
        challengeMode: true,
        participants: [{ id: 'p1', name: 'Alice', emoji: '🏃' }],
        activityTypes,
        weeklyTarget: 3,
        logs,
        scoringRules: RULES,
      } as WorkoutTrackerContent,
    };
  }

  it('adds the new activity type', () => {
    const result = tryApplyLocalUpdate('add yoga as an activity', makeCreation());
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.activityTypes).toContain('yoga');
  });

  it('preserves all existing logs when adding an activity', () => {
    const existingLogs: ActivityLog[] = [
      makeLog('l1', 'p1', '2025-05-01', 'walk'),
      makeLog('l2', 'p1', '2025-05-08', 'walk'),
      makeLog('l3', 'p1', '2025-05-15', 'run'),
    ];
    const result = tryApplyLocalUpdate('add gym activity', makeCreation(['walk', 'run'], existingLogs));
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.activityTypes).toContain('gym');
    expect(updated.logs).toHaveLength(3);
    expect(updated.logs?.map(l => l.id)).toEqual(['l1', 'l2', 'l3']);
  });

  it('does not add a duplicate activity type', () => {
    const result = tryApplyLocalUpdate('add walk as an activity', makeCreation(['walk', 'run']));
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.activityTypes?.filter(t => t === 'walk')).toHaveLength(1);
  });
});

// ── countBothHitTarget helper ─────────────────────────────────────────────────

describe('countBothHitTarget', () => {
  it('returns 0 when no past weeks exist', () => {
    expect(countBothHitTarget(['p1', 'p2'], [], 3, TODAY)).toBe(0);
  });

  it('returns 2 when both hit target for 2 consecutive past weeks', () => {
    const logs: ActivityLog[] = [
      // week of 2025-05-19
      makeLog('a1', 'p1', '2025-05-19', 'walk'),
      makeLog('a2', 'p1', '2025-05-20', 'walk'),
      makeLog('a3', 'p1', '2025-05-21', 'walk'),
      makeLog('b1', 'p2', '2025-05-19', 'walk'),
      makeLog('b2', 'p2', '2025-05-20', 'walk'),
      makeLog('b3', 'p2', '2025-05-21', 'walk'),
      // week of 2025-05-12
      makeLog('a4', 'p1', '2025-05-12', 'walk'),
      makeLog('a5', 'p1', '2025-05-13', 'walk'),
      makeLog('a6', 'p1', '2025-05-14', 'walk'),
      makeLog('b4', 'p2', '2025-05-12', 'walk'),
      makeLog('b5', 'p2', '2025-05-13', 'walk'),
      makeLog('b6', 'p2', '2025-05-14', 'walk'),
    ];
    expect(countBothHitTarget(['p1', 'p2'], logs, 3, TODAY)).toBe(2);
  });

  it('stops counting at first week where a participant did not hit target', () => {
    const logs: ActivityLog[] = [
      // week of 2025-05-19 — both hit target
      makeLog('a1', 'p1', '2025-05-19', 'walk'),
      makeLog('a2', 'p1', '2025-05-20', 'walk'),
      makeLog('a3', 'p1', '2025-05-21', 'walk'),
      makeLog('b1', 'p2', '2025-05-19', 'walk'),
      makeLog('b2', 'p2', '2025-05-20', 'walk'),
      makeLog('b3', 'p2', '2025-05-21', 'walk'),
      // week of 2025-05-12 — p2 only has 1 session (misses target=3)
      makeLog('a4', 'p1', '2025-05-12', 'walk'),
      makeLog('a5', 'p1', '2025-05-13', 'walk'),
      makeLog('a6', 'p1', '2025-05-14', 'walk'),
      makeLog('b4', 'p2', '2025-05-12', 'walk'),
    ];
    expect(countBothHitTarget(['p1', 'p2'], logs, 3, TODAY)).toBe(1);
  });
});
