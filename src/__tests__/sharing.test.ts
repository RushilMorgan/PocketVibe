/**
 * Tests for Stage 2: sharing, local update handlers, and improved summaries.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { formatCreationSummary } from '../lib/creationSummary';
import { tryApplyLocalUpdate } from '../lib/localUpdater';
import type {
  Creation,
  WorkoutTrackerContent,
  TournamentPoolTrackerContent,
} from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTournamentCreation(overrides: Partial<TournamentPoolTrackerContent> = {}): Creation {
  const content: TournamentPoolTrackerContent = {
    type: 'tournament_pool_tracker',
    poolName: 'World Cup 2026',
    tournamentName: 'FIFA World Cup',
    participants: [
      { id: 'sarah', name: 'Sarah', emoji: '👸' },
      { id: 'morgan', name: 'Morgan', emoji: '🧑' },
    ],
    teams: [
      { id: 'brazil', name: 'Brazil', pot: 1, status: 'active', assignedTo: 'sarah' },
      { id: 'japan', name: 'Japan', pot: 2, status: 'active', assignedTo: 'morgan' },
      { id: 'france', name: 'France', pot: 1, status: 'active', assignedTo: 'sarah' },
      { id: 'usa', name: 'USA', pot: 2, status: 'active' },
    ],
    matches: [],
    drawLocked: true,
    scoringRules: {
      pointsPerWin: 3,
      pointsPerDraw: 1,
      knockoutBonus: 2,
      quarterFinalBonus: 4,
      semiFinalBonus: 6,
      finalBonus: 9,
      winnerBonus: 12,
    },
    prizeNote: 'Dinner at the loser\'s choice',
    ...overrides,
  };
  return {
    id: 'c1',
    title: 'World Cup 2026',
    creationType: 'tournament_pool_tracker',
    description: '',
    summary: '',
    originalRequest: '',
    status: 'ready',
    version: 1,
    createdAt: 0,
    updatedAt: 0,
    content,
  };
}

function makeWorkoutCreation(overrides: Partial<WorkoutTrackerContent> = {}): Creation {
  const content: WorkoutTrackerContent = {
    type: 'workout_tracker',
    planName: 'Partner Challenge',
    challengeMode: true,
    participants: [
      { id: 'p1', name: 'Morgan', emoji: '🏃' },
      { id: 'p2', name: 'Partner', emoji: '🚴' },
    ],
    weeklyTarget: 3,
    scoringRules: { pointsPerActivity: 10, weeklyTargetBonus: 20, runningBonus: 5 },
    logs: [],
    ...overrides,
  };
  return {
    id: 'c2',
    title: 'Partner Challenge',
    creationType: 'workout_tracker',
    description: '',
    summary: '',
    originalRequest: '',
    status: 'ready',
    version: 1,
    createdAt: 0,
    updatedAt: 0,
    content,
  };
}

// ── formatCreationSummary — workout challenge ─────────────────────────────────

describe('formatCreationSummary — workout challenge mode', () => {
  it('includes the challenge name as the first line', () => {
    const creation = makeWorkoutCreation();
    const summary = formatCreationSummary(creation);
    expect(summary).toContain('Partner Challenge');
  });

  it('includes a Leaderboard section', () => {
    const creation = makeWorkoutCreation({
      logs: [
        { id: 'l1', participantId: 'p1', date: '2026-05-01', activityType: 'run' },
        { id: 'l2', participantId: 'p1', date: '2026-05-02', activityType: 'walk' },
        { id: 'l3', participantId: 'p2', date: '2026-05-01', activityType: 'walk' },
      ],
    });
    const summary = formatCreationSummary(creation);
    expect(summary).toContain('Leaderboard:');
    // Morgan has 2 activities: 1 run (10+5) + 1 walk (10) = 25 pts
    expect(summary).toContain('Morgan');
    expect(summary).toContain('Partner');
  });

  it('shows higher scorer first on leaderboard', () => {
    const creation = makeWorkoutCreation({
      logs: [
        { id: 'l1', participantId: 'p1', date: '2026-05-01', activityType: 'run' },
        { id: 'l2', participantId: 'p1', date: '2026-05-02', activityType: 'walk' },
        { id: 'l3', participantId: 'p1', date: '2026-05-03', activityType: 'gym' },
        { id: 'l4', participantId: 'p2', date: '2026-05-01', activityType: 'walk' },
      ],
    });
    const summary = formatCreationSummary(creation);
    // Find each name in the Leaderboard section only
    const leaderboardSection = summary.slice(summary.indexOf('Leaderboard:'));
    const morganIdx = leaderboardSection.indexOf('Morgan');
    const partnerIdx = leaderboardSection.indexOf('Partner');
    expect(morganIdx).toBeLessThan(partnerIdx);
  });

  it('shows Recent section when there are logs', () => {
    const today = new Date().toISOString().slice(0, 10);
    const creation = makeWorkoutCreation({
      logs: [{ id: 'l1', participantId: 'p1', date: today, activityType: 'run' }],
    });
    const summary = formatCreationSummary(creation);
    expect(summary).toContain('Recent:');
    expect(summary).toContain('Morgan');
  });
});

// ── formatCreationSummary — tournament pool ──────────────────────────────────

describe('formatCreationSummary — tournament pool', () => {
  it('includes pool name', () => {
    const creation = makeTournamentCreation();
    const summary = formatCreationSummary(creation);
    expect(summary).toContain('World Cup 2026');
  });

  it('includes Leaderboard section with participant names', () => {
    const creation = makeTournamentCreation();
    const summary = formatCreationSummary(creation);
    expect(summary).toContain('Leaderboard:');
    expect(summary).toContain('Sarah');
    expect(summary).toContain('Morgan');
  });

  it('includes draw status', () => {
    const creation = makeTournamentCreation({ drawLocked: true });
    const summary = formatCreationSummary(creation);
    expect(summary).toContain('Draw locked');
  });

  it('shows latest match result', () => {
    const creation = makeTournamentCreation({
      matches: [{
        id: 'm1',
        teamAId: 'brazil',
        teamBId: 'japan',
        scoreA: 2,
        scoreB: 1,
      }],
    });
    const summary = formatCreationSummary(creation);
    expect(summary).toContain('Brazil');
    expect(summary).toContain('Japan');
    expect(summary).toContain('2');
  });

  it('shows prize note', () => {
    const creation = makeTournamentCreation();
    const summary = formatCreationSummary(creation);
    expect(summary).toContain('Dinner at the loser');
  });

  it('calculates match points — winner gets 3 pts', () => {
    const creation = makeTournamentCreation({
      teams: [
        { id: 'brazil', name: 'Brazil', pot: 1, status: 'active', assignedTo: 'sarah' },
        { id: 'japan', name: 'Japan', pot: 2, status: 'active', assignedTo: 'morgan' },
      ],
      matches: [{ id: 'm1', teamAId: 'brazil', teamBId: 'japan', scoreA: 2, scoreB: 1 }],
    });
    const summary = formatCreationSummary(creation);
    // Sarah (Brazil won) should be first with 3 pts
    const sarahIdx = summary.indexOf('Sarah');
    const morganIdx = summary.indexOf('Morgan');
    expect(sarahIdx).toBeLessThan(morganIdx);
  });
});

// ── tryApplyLocalUpdate — tournament pool new handlers ───────────────────────

describe('tryApplyLocalUpdate — tournament pool', () => {
  it('"Brazil beat Japan 2-1" adds a match result', () => {
    const creation = makeTournamentCreation({ matches: [] });
    const result = tryApplyLocalUpdate('Brazil beat Japan 2-1', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as TournamentPoolTrackerContent;
    expect(updated.matches).toHaveLength(1);
    expect(updated.matches[0].scoreA).toBe(2);
    expect(updated.matches[0].scoreB).toBe(1);
    expect(updated.matches[0].teamAId).toBe('brazil');
    expect(updated.matches[0].teamBId).toBe('japan');
  });

  it('"Brazil beat Japan 2–1" (em-dash) also works', () => {
    const creation = makeTournamentCreation({ matches: [] });
    const result = tryApplyLocalUpdate('Brazil beat Japan 2–1', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as TournamentPoolTrackerContent;
    expect(updated.matches).toHaveLength(1);
  });

  it('"mark Brazil as winner" updates team status', () => {
    const creation = makeTournamentCreation();
    const result = tryApplyLocalUpdate('mark Brazil as winner', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as TournamentPoolTrackerContent;
    const brazil = updated.teams.find(t => t.name === 'Brazil');
    expect(brazil?.status).toBe('winner');
  });

  it('"mark France as eliminated" updates team status', () => {
    const creation = makeTournamentCreation();
    const result = tryApplyLocalUpdate('mark France as eliminated', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as TournamentPoolTrackerContent;
    const france = updated.teams.find(t => t.name === 'France');
    expect(france?.status).toBe('eliminated');
  });

  it('"France is eliminated" also works', () => {
    const creation = makeTournamentCreation();
    const result = tryApplyLocalUpdate('France is eliminated', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as TournamentPoolTrackerContent;
    const france = updated.teams.find(t => t.name === 'France');
    expect(france?.status).toBe('eliminated');
  });

  it('"draw all" assigns all unassigned teams', () => {
    const creation = makeTournamentCreation({
      teams: [
        { id: 'brazil', name: 'Brazil', pot: 1, status: 'active' },
        { id: 'japan', name: 'Japan', pot: 2, status: 'active' },
        { id: 'france', name: 'France', pot: 1, status: 'active' },
        { id: 'usa', name: 'USA', pot: 2, status: 'active' },
      ],
      drawLocked: false,
    });
    const result = tryApplyLocalUpdate('draw all', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as TournamentPoolTrackerContent;
    expect(updated.drawLocked).toBe(true);
    const unassigned = updated.teams.filter(t => !t.assignedTo);
    expect(unassigned).toHaveLength(0);
  });

  it('"run the draw" is handled', () => {
    const creation = makeTournamentCreation({
      teams: [{ id: 'brazil', name: 'Brazil', pot: 1, status: 'active' }],
      drawLocked: false,
    });
    const result = tryApplyLocalUpdate('run the draw', creation);
    expect(result.handled).toBe(true);
  });

  it('"reset the draw" clears all assignments and unlocks', () => {
    const creation = makeTournamentCreation({ drawLocked: true });
    const result = tryApplyLocalUpdate('reset the draw', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as TournamentPoolTrackerContent;
    expect(updated.drawLocked).toBe(false);
    const assigned = updated.teams.filter(t => t.assignedTo);
    expect(assigned).toHaveLength(0);
  });

  it('"clear the draw" also resets assignments', () => {
    const creation = makeTournamentCreation({ drawLocked: true });
    const result = tryApplyLocalUpdate('clear the draw', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as TournamentPoolTrackerContent;
    expect(updated.drawLocked).toBe(false);
  });

  it('"remove Sarah" removes participant by name', () => {
    const creation = makeTournamentCreation();
    const result = tryApplyLocalUpdate('remove Sarah', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as TournamentPoolTrackerContent;
    expect(updated.participants.find(p => p.name === 'Sarah')).toBeUndefined();
    expect(updated.participants).toHaveLength(1);
  });
});

// ── tryApplyLocalUpdate — workout challenge new handlers ─────────────────────

describe('tryApplyLocalUpdate — workout challenge', () => {
  it('"Morgan walked today" logs a walk for Morgan', () => {
    const creation = makeWorkoutCreation();
    const result = tryApplyLocalUpdate('Morgan walked today', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.logs).toHaveLength(1);
    expect(updated.logs![0].participantId).toBe('p1');
    expect(updated.logs![0].activityType).toBe('walk');
  });

  it('"Morgan ran today" logs a run', () => {
    const creation = makeWorkoutCreation();
    const result = tryApplyLocalUpdate('Morgan ran today', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.logs![0].activityType).toBe('run');
  });

  it('"log 5km run for Morgan" logs with distance', () => {
    const creation = makeWorkoutCreation();
    const result = tryApplyLocalUpdate('log 5km run for Morgan', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.logs).toHaveLength(1);
    expect(updated.logs![0].activityType).toBe('run');
    expect(updated.logs![0].distance).toBe('5km');
    expect(updated.logs![0].participantId).toBe('p1');
  });

  it('"undo my last activity" removes the last log', () => {
    const today = new Date().toISOString().slice(0, 10);
    const creation = makeWorkoutCreation({
      logs: [
        { id: 'l1', participantId: 'p1', date: today, activityType: 'walk' },
        { id: 'l2', participantId: 'p2', date: today, activityType: 'run' },
      ],
    });
    const result = tryApplyLocalUpdate('undo my last activity', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.logs).toHaveLength(1);
    expect(updated.logs![0].id).toBe('l1');
  });

  it('"undo last" also works', () => {
    const today = new Date().toISOString().slice(0, 10);
    const creation = makeWorkoutCreation({
      logs: [{ id: 'l1', participantId: 'p1', date: today, activityType: 'walk' }],
    });
    const result = tryApplyLocalUpdate('undo last', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.logs).toHaveLength(0);
  });

  it('"remove Sarah" removes workout participant by name', () => {
    const creation = makeWorkoutCreation({
      participants: [
        { id: 'p1', name: 'Morgan', emoji: '🏃' },
        { id: 'p2', name: 'Sarah', emoji: '🚴' },
      ],
    });
    const result = tryApplyLocalUpdate('remove Sarah', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.participants?.find(p => p.name === 'Sarah')).toBeUndefined();
  });

  it('"change Morgan to Mo" renames participant', () => {
    const creation = makeWorkoutCreation();
    const result = tryApplyLocalUpdate('change Morgan to Mo', creation);
    expect(result.handled).toBe(true);
    const updated = result.updatedContent as WorkoutTrackerContent;
    expect(updated.participants?.find(p => p.name === 'Mo')).toBeDefined();
    expect(updated.participants?.find(p => p.name === 'Morgan')).toBeUndefined();
  });
});

// ── shareService — unit tests with mocked fetch ───────────────────────────────

describe('shareService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('createSharedCreation calls edge function and returns result', async () => {
    const mockResult = {
      shareSlug: 'abc12345',
      viewUrl: 'https://app/s/abc12345',
      adminUrl: 'https://app/s/abc12345?admin=token123',
      adminToken: 'token123',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const { createSharedCreation } = await import('../services/shareService');
    const creation = makeWorkoutCreation();
    const result = await createSharedCreation(creation);

    expect(result.shareSlug).toBe('abc12345');
    expect(result.adminToken).toBe('token123');
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('getSharedCreation calls edge function with slug', async () => {
    const mockResponse = {
      creation: {
        shareSlug: 'abc12345',
        title: 'Test',
        creationType: 'workout_tracker',
        content: { type: 'workout_tracker', planName: 'Test', challengeMode: true, logs: [] },
        version: 1,
        createdAt: 0,
        updatedAt: 0,
      },
      accessMode: 'viewer',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { getSharedCreation } = await import('../services/shareService');
    const result = await getSharedCreation('abc12345');

    expect(result.accessMode).toBe('viewer');
    expect(result.creation.shareSlug).toBe('abc12345');
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toContain('shareSlug=abc12345');
  });

  it('getSharedCreation passes token as query param', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ creation: {}, accessMode: 'admin' }),
    });

    const { getSharedCreation } = await import('../services/shareService');
    await getSharedCreation('abc12345', 'my-token');

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toContain('token=my-token');
  });

  it('updateSharedCreation sends PATCH with correct body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 2, content: {} }),
    });

    const { updateSharedCreation } = await import('../services/shareService');
    const result = await updateSharedCreation('abc12345', 'admin-token', { logs: [] } as any, 1);

    expect(result.version).toBe(2);
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.shareSlug).toBe('abc12345');
    expect(body.token).toBe('admin-token');
    expect(body.expectedVersion).toBe(1);
  });

  it('throws error with message on non-OK response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Shared creation not found' }),
    });

    const { getSharedCreation } = await import('../services/shareService');
    await expect(getSharedCreation('bad-slug')).rejects.toThrow('Shared creation not found');
  });

  it('deleteOwnedCreation deletes the row by id and reports success', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq });
    const { supabase } = await import('../lib/supabaseClient');
    vi.spyOn(supabase!, 'from').mockReturnValue({ delete: del } as any);

    const { deleteOwnedCreation } = await import('../services/shareService');
    const ok = await deleteOwnedCreation('row-123');

    expect(ok).toBe(true);
    expect(del).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('id', 'row-123');
  });

  it('deleteOwnedCreation returns false when the delete errors', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'denied' } });
    const { supabase } = await import('../lib/supabaseClient');
    vi.spyOn(supabase!, 'from').mockReturnValue({ delete: () => ({ eq }) } as any);

    const { deleteOwnedCreation } = await import('../services/shareService');
    expect(await deleteOwnedCreation('row-123')).toBe(false);
  });
});
