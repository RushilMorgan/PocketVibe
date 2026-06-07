/**
 * Smart Guidance layer tests.
 * Tests computePoolGuidance and computeWorkoutGuidance pure functions.
 * Also tests that theme changes do not reset user data.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { computePoolGuidance, computeWorkoutGuidance } from '../lib/guidance';
import type { TournamentPoolTrackerContent, WorkoutTrackerContent } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePool(overrides: Partial<TournamentPoolTrackerContent> = {}): TournamentPoolTrackerContent {
  return {
    type: 'tournament_pool_tracker',
    poolName: 'WC2026 Pool',
    tournamentName: 'WC2026',
    participants: [],
    teams: [],
    matches: [],
    drawLocked: false,
    scoringRules: {
      pointsPerWin: 3,
      pointsPerDraw: 1,
      knockoutBonus: 2,
      quarterFinalBonus: 3,
      semiFinalBonus: 4,
      finalBonus: 5,
      winnerBonus: 10,
    },
    prizeNote: '',
    ...overrides,
  };
}

function makeWorkout(overrides: Partial<WorkoutTrackerContent> = {}): WorkoutTrackerContent {
  return {
    type: 'workout_tracker',
    planName: 'Partner Challenge',
    challengeMode: true,
    participants: [],
    logs: [],
    activityTypes: ['walk', 'run', 'gym'],
    weeklyTarget: 3,
    scoringRules: { pointsPerActivity: 10, weeklyTargetBonus: 20, runningBonus: 5 },
    ...overrides,
  };
}

function makeTeam(id: string, pot = 1, assignedTo?: string) {
  return { id, name: `Team ${id}`, flagEmoji: '\uD83C\uDFF3\uFE0F', group: 'A', pot, status: 'active' as const, assignedTo };
}

function makeParticipant(id: string, name: string) {
  return { id, name, emoji: '🏃' };
}

function makeLog(id: string, participantId: string) {
  return { id, participantId, date: '2025-01-01', activityType: 'walk' as const };
}

// ── Pool guidance ─────────────────────────────────────────────────────────────

describe('computePoolGuidance', () => {
  it('fresh pool with demo_fallback teams: suggests add-people, teams step done, no draw suggestion', () => {
    const content = makePool({
      teams: Array.from({ length: 48 }, (_, i) => makeTeam(`t${i}`, (i % 4) + 1)),
      teamsSource: 'demo_fallback',
    });
    const guidance = computePoolGuidance(content, false);

    // Setup step 1 (add-people) should be NOT done
    const addPeopleStep = guidance.setupSteps.find(s => s.id === 'add-people')!;
    expect(addPeopleStep.done).toBe(false);

    // Setup step 2 (teams-loaded) should be DONE
    const teamsStep = guidance.setupSteps.find(s => s.id === 'teams-loaded')!;
    expect(teamsStep.done).toBe(true);

    // "Add people" suggestion should be present
    const addPeopleSuggestion = guidance.suggestions.find(s => s.id === 'need-people');
    expect(addPeopleSuggestion).toBeDefined();

    // Quick actions should include add-people
    const addPeopleAction = guidance.quickActions.find(a => a.id === 'add-people');
    expect(addPeopleAction).toBeDefined();

    // No draw suggestion yet (no participants)
    const drawSuggestion = guidance.suggestions.find(s => s.id === 'run-draw');
    expect(drawSuggestion).toBeUndefined();

    // isSetupComplete should be false
    expect(guidance.isSetupComplete).toBe(false);
  });

  it('after participants added: suggests run-draw, quick actions include run-draw-all', () => {
    const teams = Array.from({ length: 48 }, (_, i) => makeTeam(`t${i}`, (i % 4) + 1));
    const content = makePool({
      participants: [makeParticipant('p1', 'Alice'), makeParticipant('p2', 'Bob')],
      teams,
    });
    const guidance = computePoolGuidance(content, false);

    // add-people step done
    const addPeopleStep = guidance.setupSteps.find(s => s.id === 'add-people')!;
    expect(addPeopleStep.done).toBe(true);

    // run-draw suggestion present
    const drawSuggestion = guidance.suggestions.find(s => s.id === 'run-draw');
    expect(drawSuggestion).toBeDefined();
    expect(drawSuggestion!.actionId).toBe('run-draw-all');

    // quick action run-draw-all present and primary
    const drawAction = guidance.quickActions.find(a => a.id === 'run-draw-all');
    expect(drawAction).toBeDefined();
    expect(drawAction!.variant).toBe('primary');
  });

  it('draw locked: isSetupComplete=true, no run-draw suggestion', () => {
    const teams = Array.from({ length: 4 }, (_, i) =>
      makeTeam(`t${i}`, 1, i % 2 === 0 ? 'p1' : 'p2')
    );
    const content = makePool({
      participants: [makeParticipant('p1', 'Alice'), makeParticipant('p2', 'Bob')],
      teams,
      drawLocked: true,
    });
    const guidance = computePoolGuidance(content, false);

    expect(guidance.isSetupComplete).toBe(true);

    // No "Run draw" suggestion
    const drawSuggestion = guidance.suggestions.find(s => s.id === 'run-draw');
    expect(drawSuggestion).toBeUndefined();

    // Should suggest sharing (no share link yet)
    const shareSuggestion = guidance.suggestions.find(s => s.id === 'share-pool');
    expect(shareSuggestion).toBeDefined();

    // Setup checklist complete means no amber box shown in component
    const lockStep = guidance.setupSteps.find(s => s.id === 'lock-and-share')!;
    expect(lockStep.done).toBe(true);
  });

  it('draw locked WITH share link: suggests send-links not share-pool', () => {
    const teams = Array.from({ length: 4 }, (_, i) =>
      makeTeam(`t${i}`, 1, i % 2 === 0 ? 'p1' : 'p2')
    );
    const content = makePool({
      participants: [makeParticipant('p1', 'Alice'), makeParticipant('p2', 'Bob')],
      teams,
      drawLocked: true,
    });
    const guidance = computePoolGuidance(content, true); // hasShareLink = true

    const sharePoolSuggestion = guidance.suggestions.find(s => s.id === 'share-pool');
    expect(sharePoolSuggestion).toBeUndefined();

    const sendLinksSuggestion = guidance.suggestions.find(s => s.id === 'send-links');
    expect(sendLinksSuggestion).toBeDefined();
    expect(sendLinksSuggestion!.label).toMatch(/invite|links/i);
  });

  it('does not show a demo/built-in teams suggestion (teams are confirmed)', () => {
    const content = makePool({
      participants: [makeParticipant('p1', 'Alice')],
      teams: [makeTeam('t1', 1)],
      teamsSource: 'demo_fallback',
    });
    const guidance = computePoolGuidance(content, false);
    expect(guidance.suggestions.find(s => s.id === 'local-teams')).toBeUndefined();
  });

  it('all teams assigned but NOT locked: suggests lock-draw with primary quick action', () => {
    const teams = [
      makeTeam('t1', 1, 'p1'),
      makeTeam('t2', 1, 'p2'),
    ];
    const content = makePool({
      participants: [makeParticipant('p1', 'Alice'), makeParticipant('p2', 'Bob')],
      teams,
      drawLocked: false,
    });
    const guidance = computePoolGuidance(content, false);

    const lockSuggestion = guidance.suggestions.find(s => s.id === 'lock-draw');
    expect(lockSuggestion).toBeDefined();

    const lockAction = guidance.quickActions.find(a => a.id === 'lock-draw');
    expect(lockAction).toBeDefined();
    expect(lockAction!.variant).toBe('primary');
  });
});

// ── Workout guidance ──────────────────────────────────────────────────────────

describe('computeWorkoutGuidance', () => {
  it('fresh: suggests add-partner, setup step add-partner not done', () => {
    const content = makeWorkout();
    const guidance = computeWorkoutGuidance(content, false);

    const addPartnerStep = guidance.setupSteps.find(s => s.id === 'add-partner')!;
    expect(addPartnerStep.done).toBe(false);

    const addPartnerSuggestion = guidance.suggestions.find(s => s.id === 'add-partner');
    expect(addPartnerSuggestion).toBeDefined();
    expect(addPartnerSuggestion!.actionId).toBe('add-partner');

    expect(guidance.isSetupComplete).toBe(false);
  });

  it('after 2 participants added: add-partner step done, suggests log-activity', () => {
    const content = makeWorkout({
      participants: [makeParticipant('p1', 'Alice'), makeParticipant('p2', 'Bob')],
    });
    const guidance = computeWorkoutGuidance(content, false);

    const addPartnerStep = guidance.setupSteps.find(s => s.id === 'add-partner')!;
    expect(addPartnerStep.done).toBe(true);

    const addPartnerSuggestion = guidance.suggestions.find(s => s.id === 'add-partner');
    expect(addPartnerSuggestion).toBeUndefined();

    const logSuggestion = guidance.suggestions.find(s => s.id === 'first-log');
    expect(logSuggestion).toBeDefined();
    expect(logSuggestion!.actionId).toBe('log-activity');
  });

  it('with partner + logs + share link: isSetupComplete=true, suggests keep-going', () => {
    const content = makeWorkout({
      participants: [makeParticipant('p1', 'Alice'), makeParticipant('p2', 'Bob')],
      logs: [makeLog('l1', 'p1'), makeLog('l2', 'p2')],
    });
    const guidance = computeWorkoutGuidance(content, true); // hasShareLink = true

    expect(guidance.isSetupComplete).toBe(true);

    const keepGoingSuggestion = guidance.suggestions.find(s => s.id === 'keep-going');
    expect(keepGoingSuggestion).toBeDefined();
    expect(keepGoingSuggestion!.actionId).toBe('log-activity');
  });

  it('with partner + logs but no share link: suggests share', () => {
    const content = makeWorkout({
      participants: [makeParticipant('p1', 'Alice'), makeParticipant('p2', 'Bob')],
      logs: [makeLog('l1', 'p1')],
    });
    const guidance = computeWorkoutGuidance(content, false);

    const shareSuggestion = guidance.suggestions.find(s => s.id === 'share');
    expect(shareSuggestion).toBeDefined();
    expect(shareSuggestion!.actionId).toBe('share');
  });

  it('log-activity quick action is primary when partner exists', () => {
    const content = makeWorkout({
      participants: [makeParticipant('p1', 'Alice'), makeParticipant('p2', 'Bob')],
    });
    const guidance = computeWorkoutGuidance(content, false);
    const logAction = guidance.quickActions.find(a => a.id === 'log-activity');
    expect(logAction?.variant).toBe('primary');
  });

  it('log-activity quick action is default when no partner', () => {
    const content = makeWorkout();
    const guidance = computeWorkoutGuidance(content, false);
    const logAction = guidance.quickActions.find(a => a.id === 'log-activity');
    expect(logAction?.variant).toBe('default');
  });
});

// ── Theme safety ───────────────────────────────────────────────────────────────

describe('Theme change does not reset data', () => {
  it('applying colourTheme preserves participants, teams, draw state', () => {
    const original = makePool({
      participants: [makeParticipant('p1', 'Alice'), makeParticipant('p2', 'Bob')],
      teams: [makeTeam('t1', 1, 'p1'), makeTeam('t2', 1, 'p2')],
      drawLocked: true,
      prizeNote: '£50 to the winner',
    });

    // Simulate the update({ colourTheme: 'bold' }) spread
    const updated: TournamentPoolTrackerContent = { ...original, colourTheme: 'bold' };

    expect(updated.colourTheme).toBe('bold');
    expect(updated.participants).toHaveLength(2);
    expect(updated.teams).toHaveLength(2);
    expect(updated.drawLocked).toBe(true);
    expect(updated.prizeNote).toBe('£50 to the winner');
    expect(updated.participants[0].name).toBe('Alice');
  });

  it('applying colourTheme to workout preserves logs, participants, weekly target', () => {
    const original = makeWorkout({
      participants: [makeParticipant('p1', 'Alice'), makeParticipant('p2', 'Bob')],
      logs: [makeLog('l1', 'p1'), makeLog('l2', 'p2'), makeLog('l3', 'p1')],
      weeklyTarget: 5,
    });

    const updated: WorkoutTrackerContent = { ...original, colourTheme: 'fun' };

    expect(updated.colourTheme).toBe('fun');
    expect(updated.participants).toHaveLength(2);
    expect(updated.logs).toHaveLength(3);
    expect(updated.weeklyTarget).toBe(5);
  });
});

// ── Suggestions cap ───────────────────────────────────────────────────────────

describe('Suggestions cap at 5', () => {
  it('never returns more than 5 suggestions for pool', () => {
    const content = makePool({ teamsSource: 'demo_fallback' });
    const guidance = computePoolGuidance(content, false);
    expect(guidance.suggestions.length).toBeLessThanOrEqual(5);
  });

  it('never returns more than 5 suggestions for workout', () => {
    const content = makeWorkout();
    const guidance = computeWorkoutGuidance(content, false);
    expect(guidance.suggestions.length).toBeLessThanOrEqual(5);
  });

  // ── Test 9: AI suggestion when both participants hit target multiple weeks ──

  it('suggests increasing target when both participants hit target for 2+ consecutive past weeks', () => {
    // Use dates firmly in the past (2025 weeks) — always before "today" whenever this runs
    const bothHitLogs = [
      // week of 2025-05-12 (Mon) — both hit target=3
      { id: 'a1', participantId: 'p1', date: '2025-05-12', activityType: 'walk' as const },
      { id: 'a2', participantId: 'p1', date: '2025-05-13', activityType: 'walk' as const },
      { id: 'a3', participantId: 'p1', date: '2025-05-14', activityType: 'walk' as const },
      { id: 'b1', participantId: 'p2', date: '2025-05-12', activityType: 'walk' as const },
      { id: 'b2', participantId: 'p2', date: '2025-05-13', activityType: 'walk' as const },
      { id: 'b3', participantId: 'p2', date: '2025-05-14', activityType: 'walk' as const },
      // week of 2025-05-19 (Mon) — both hit target=3
      { id: 'a4', participantId: 'p1', date: '2025-05-19', activityType: 'walk' as const },
      { id: 'a5', participantId: 'p1', date: '2025-05-20', activityType: 'walk' as const },
      { id: 'a6', participantId: 'p1', date: '2025-05-21', activityType: 'walk' as const },
      { id: 'b4', participantId: 'p2', date: '2025-05-19', activityType: 'walk' as const },
      { id: 'b5', participantId: 'p2', date: '2025-05-20', activityType: 'walk' as const },
      { id: 'b6', participantId: 'p2', date: '2025-05-21', activityType: 'walk' as const },
    ];
    const content = makeWorkout({
      participants: [
        { id: 'p1', name: 'Alice', emoji: '🏃' },
        { id: 'p2', name: 'Bob', emoji: '🚶' },
      ],
      weeklyTarget: 3,
      logs: bothHitLogs,
    });
    const guidance = computeWorkoutGuidance(content, true);
    const suggestion = guidance.suggestions.find(s => s.id === 'increase-target');
    expect(suggestion).toBeDefined();
    expect(suggestion?.label).toMatch(/smashing it/i);
    expect(suggestion?.actionId).toBe('set-target');
  });

  it('does NOT suggest increasing target when only 1 week of both hitting target', () => {
    const oneWeekLogs = [
      { id: 'a1', participantId: 'p1', date: '2025-05-19', activityType: 'walk' as const },
      { id: 'a2', participantId: 'p1', date: '2025-05-20', activityType: 'walk' as const },
      { id: 'a3', participantId: 'p1', date: '2025-05-21', activityType: 'walk' as const },
      { id: 'b1', participantId: 'p2', date: '2025-05-19', activityType: 'walk' as const },
      { id: 'b2', participantId: 'p2', date: '2025-05-20', activityType: 'walk' as const },
      { id: 'b3', participantId: 'p2', date: '2025-05-21', activityType: 'walk' as const },
    ];
    const content = makeWorkout({
      participants: [
        { id: 'p1', name: 'Alice', emoji: '🏃' },
        { id: 'p2', name: 'Bob', emoji: '🚶' },
      ],
      weeklyTarget: 3,
      logs: oneWeekLogs,
    });
    const guidance = computeWorkoutGuidance(content, true);
    const suggestion = guidance.suggestions.find(s => s.id === 'increase-target');
    expect(suggestion).toBeUndefined();
  });
});

