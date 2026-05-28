/**
 * Read-only leaderboard view for Partner Challenge (workout_tracker) viewers.
 * Viewers can see the standings, recent activity, and scoring rules,
 * but cannot log activity or edit anything.
 * Includes a "Make my own version" button so viewers can remix the challenge.
 */
import React, { useMemo } from 'react';
import type {
  WorkoutTrackerContent,
  ChallengeParticipant,
  ActivityLog,
  ChallengeScoringRules,
} from '../../types';
import { THEMES, getWorkoutGradient } from '../../lib/themes';

interface Props {
  content: WorkoutTrackerContent;
  onRemix?: () => void;
}

const ACTIVITY_ICON: Record<string, string> = {
  walk: '🚶',
  run: '🏃',
  gym: '💪',
  other: '⭐',
};

const MEDAL = ['🥇', '🥈', '🥉'];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(dateStr: string): string {
  return getMonday(new Date(dateStr + 'T12:00:00')).toISOString().slice(0, 10);
}

function calcScores(
  participants: ChallengeParticipant[],
  logs: ActivityLog[],
  rules: ChallengeScoringRules,
  weeklyTarget: number,
  todayStr: string,
) {
  const thisWeek = weekKey(todayStr);
  return participants
    .map(p => {
      const myLogs = logs.filter(l => l.participantId === p.id);
      const weekCounts = new Map<string, number>();
      let points = 0;
      for (const log of myLogs) {
        const wk = weekKey(log.date);
        weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1);
        points += rules.pointsPerActivity;
        if (log.activityType === 'run') points += rules.runningBonus;
      }
      for (const count of weekCounts.values()) {
        if (count >= weeklyTarget) points += rules.weeklyTargetBonus;
      }
      return {
        participant: p,
        points,
        sessionsThisWeek: weekCounts.get(thisWeek) ?? 0,
        totalSessions: myLogs.length,
      };
    })
    .sort((a, b) => b.points - a.points);
}

export function WorkoutTrackerReadView({ content, onRemix }: Props) {
  const participants = content.participants ?? [];
  const logs = content.logs ?? [];
  const weeklyTarget = content.weeklyTarget ?? 3;
  const rules: ChallengeScoringRules = content.scoringRules ?? {
    pointsPerActivity: 10,
    weeklyTargetBonus: 20,
    runningBonus: 5,
  };

  const today = new Date().toISOString().slice(0, 10);
  const ranked = useMemo(
    () => calcScores(participants, logs, rules, weeklyTarget, today),
    [participants, logs, rules, weeklyTarget, today],
  );

  const theme = THEMES.find(t => t.id === content.colourTheme) ?? THEMES[0];
  const gradient = getWorkoutGradient(content.colourTheme);

  const recentLogs = [...logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white`}>
        <h2 className="text-xl font-bold">{content.planName || 'Partner Challenge'}</h2>
        <p className="text-sm opacity-80 mt-0.5">Partner Challenge · View only</p>
      </div>

      {/* Leaderboard */}
      {ranked.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Leaderboard</p>
          <div className="space-y-2">
            {ranked.map((score, i) => (
              <div key={score.participant.id} className="flex items-center gap-3 py-2 px-3 rounded-xl">
                <span className="text-lg w-6 text-center flex-shrink-0">
                  {i < 3 ? MEDAL[i] : `#${i + 1}`}
                </span>
                <span className="text-xl flex-shrink-0">{score.participant.emoji ?? '👤'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{score.participant.name}</p>
                  <p className="text-xs text-gray-400">
                    {score.sessionsThisWeek}/{weeklyTarget} this week · {score.totalSessions} total
                  </p>
                </div>
                <span className="text-sm font-bold text-gray-800">{score.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recentLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recent activity</p>
          <div className="space-y-2">
            {recentLogs.map(log => {
              const p = participants.find(x => x.id === log.participantId);
              return (
                <div key={log.id} className="flex items-center gap-3 py-1.5">
                  <span className="text-lg flex-shrink-0">{p?.emoji ?? '👤'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">{p?.name ?? 'Unknown'}</span>
                      {' '}{ACTIVITY_ICON[log.activityType] ?? '⭐'} {log.activityType}
                      {log.duration && <span className="text-gray-400"> · {log.duration}</span>}
                    </p>
                    {log.note && <p className="text-xs text-gray-400 truncate">{log.note}</p>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{log.date}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scoring rules */}
      <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Scoring</p>
        <div className="space-y-1 text-xs text-gray-600">
          <p>🏃 Per activity: {rules.pointsPerActivity} pts</p>
          {rules.runningBonus > 0 && <p>🏃 Running bonus: +{rules.runningBonus} pts</p>}
          {rules.weeklyTargetBonus > 0 && (
            <p>🎯 Hit {weeklyTarget} sessions/week: +{rules.weeklyTargetBonus} pts</p>
          )}
        </div>
      </div>

      {/* Make my own version */}
      {onRemix && (
        <div className="bg-violet-50 rounded-2xl border border-violet-100 p-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-violet-800">Like this challenge?</p>
          <p className="text-xs text-violet-600">
            Make your own private copy with the same rules and participants.
          </p>
          <button
            data-testid="remix-btn"
            onClick={onRemix}
            className="w-full bg-violet-600 text-white text-sm font-semibold rounded-xl py-3 active:bg-violet-700"
          >
            Make my own version
          </button>
        </div>
      )}
    </div>
  );
}
