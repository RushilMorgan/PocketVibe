import { describe, it, expect } from 'vitest';
import { remixContent } from '../lib/remixContent';
import type { WorkoutTrackerContent, TournamentPoolTrackerContent } from '../types';

describe('remixContent', () => {
  it('strips activity logs from workout_tracker', () => {
    const content: WorkoutTrackerContent = {
      type: 'workout_tracker',
      planName: 'Summer Challenge',
      challengeMode: true,
      participants: [{ id: 'p1', name: 'Alice', emoji: '💪' }],
      logs: [
        { id: 'l1', participantId: 'p1', date: '2026-01-01', activityType: 'walk' },
        { id: 'l2', participantId: 'p1', date: '2026-01-02', activityType: 'run' },
      ],
      activityTypes: ['walk', 'run'],
      weeklyTarget: 3,
      scoringRules: { pointsPerActivity: 10, weeklyTargetBonus: 20, runningBonus: 5 },
    };
    const result = remixContent(content, 'workout_tracker') as WorkoutTrackerContent;
    expect(result.logs).toHaveLength(0);
    expect(result.participants).toHaveLength(1);
    expect(result.planName).toBe('Summer Challenge');
    expect(result.scoringRules?.pointsPerActivity).toBe(10);
  });

  it('keeps participants and rules when stripping logs', () => {
    const content: WorkoutTrackerContent = {
      type: 'workout_tracker',
      planName: 'Challenge',
      participants: [
        { id: 'p1', name: 'Alice', emoji: '🏃' },
        { id: 'p2', name: 'Bob', emoji: '💪' },
      ],
      logs: [{ id: 'l1', participantId: 'p1', date: '2026-01-01', activityType: 'gym' }],
    };
    const result = remixContent(content, 'workout_tracker') as WorkoutTrackerContent;
    expect(result.participants).toHaveLength(2);
    expect(result.logs).toEqual([]);
  });

  it('strips changeRequests and resets drawLocked for tournament_pool_tracker', () => {
    const content = {
      type: 'tournament_pool_tracker' as const,
      poolName: 'My Pool',
      tournamentName: 'WC 2026',
      participants: [{ id: 'p1', name: 'Alice', emoji: '⚽', teamsCount: 2 }],
      teams: [{ id: 't1', name: 'Brazil', pot: 1, status: 'active' as const }],
      scoringRules: {
        pointsPerWin: 3,
        pointsPerDraw: 1,
        knockoutBonus: 2,
        semiFinalBonus: 3,
        winnerBonus: 5,
      },
      drawLocked: true,
      changeRequests: [
        { id: 'cr1', participantId: 'p1', participantName: 'Alice', description: 'Fix score', status: 'pending' as const, createdAt: 1000 },
      ],
      matches: [],
    } as unknown as TournamentPoolTrackerContent;

    const result = remixContent(content, 'tournament_pool_tracker') as TournamentPoolTrackerContent;
    expect(result.drawLocked).toBe(false);
    expect(result.changeRequests).toHaveLength(0);
    expect(result.participants).toHaveLength(1);
    expect(result.teams).toHaveLength(1);
  });

  it('does not mutate the original content', () => {
    const content: WorkoutTrackerContent = {
      type: 'workout_tracker',
      planName: 'Test',
      logs: [{ id: 'l1', participantId: 'p1', date: '2026-01-01', activityType: 'walk' }],
    };
    remixContent(content, 'workout_tracker');
    expect(content.logs).toHaveLength(1);
  });
});
