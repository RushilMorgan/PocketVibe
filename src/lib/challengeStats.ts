/**
 * Pure functions for calculating Partner Challenge statistics from activity logs.
 * All views (weekly, monthly, all-time) are derived from the logs array — history
 * is never lost because totals are never stored; they are always recalculated.
 */
import type { ActivityLog, ChallengeScoringRules } from '../types';

// ── Public types ──────────────────────────────────────────────────────────────

export interface WeekStats {
  weekStart: string; // ISO date (Monday)
  sessions: number;
  points: number;
  hitTarget: boolean;
}

export interface MonthStats {
  year: number;
  month: number; // 0-based (0 = January)
  sessions: number;
  points: number;
  weeksHitTarget: number;
}

export interface AllTimeStats {
  sessions: number;
  points: number;
  bestWeekSessions: number;
  /** Consecutive complete past weeks ending at most recent where target was hit. */
  currentStreak: number;
  longestStreak: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

export function weekKey(dateStr: string): string {
  // Always work in UTC to avoid timezone day-boundary shifts.
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

function pointsForWeekLogs(
  weekLogs: ActivityLog[],
  rules: ChallengeScoringRules,
  weeklyTarget: number,
): number {
  let pts = 0;
  for (const log of weekLogs) {
    pts += rules.pointsPerActivity ?? 10;
    if (log.activityType === 'run') pts += rules.runningBonus ?? 0;
  }
  if (weekLogs.length >= weeklyTarget) pts += rules.weeklyTargetBonus ?? 20;
  return pts;
}

// ── Public functions ──────────────────────────────────────────────────────────

/** Current week sessions and points for a single participant, calculated from logs. */
export function getCurrentWeekStats(
  participantId: string,
  logs: ActivityLog[],
  rules: ChallengeScoringRules,
  weeklyTarget: number,
  todayStr: string,
): WeekStats {
  const thisWeek = weekKey(todayStr);
  const weekLogs = logs.filter(
    l => l.participantId === participantId && weekKey(l.date) === thisWeek,
  );
  return {
    weekStart: thisWeek,
    sessions: weekLogs.length,
    points: pointsForWeekLogs(weekLogs, rules, weeklyTarget),
    hitTarget: weekLogs.length >= weeklyTarget,
  };
}

/** Past weeks (most recent first), excluding the current week. */
export function getPastWeeks(
  participantId: string,
  logs: ActivityLog[],
  rules: ChallengeScoringRules,
  weeklyTarget: number,
  todayStr: string,
  count = 8,
): WeekStats[] {
  const thisWeek = weekKey(todayStr);
  const myLogs = logs.filter(l => l.participantId === participantId);
  const pastWeekKeys = new Set(
    myLogs.map(l => weekKey(l.date)).filter(wk => wk < thisWeek),
  );
  return Array.from(pastWeekKeys)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, count)
    .map(wk => {
      const weekLogs = myLogs.filter(l => weekKey(l.date) === wk);
      return {
        weekStart: wk,
        sessions: weekLogs.length,
        points: pointsForWeekLogs(weekLogs, rules, weeklyTarget),
        hitTarget: weekLogs.length >= weeklyTarget,
      };
    });
}

/** Monthly totals for a single participant, calculated from logs. */
export function getMonthStats(
  participantId: string,
  logs: ActivityLog[],
  rules: ChallengeScoringRules,
  weeklyTarget: number,
  year: number,
  month: number, // 0-based
): MonthStats {
  const monthLogs = logs.filter(l => {
    if (l.participantId !== participantId) return false;
    const d = new Date(l.date + 'T12:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const weekCounts = new Map<string, number>();
  let points = 0;
  for (const log of monthLogs) {
    const wk = weekKey(log.date);
    weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1);
    points += rules.pointsPerActivity;
    if (log.activityType === 'run') points += rules.runningBonus;
  }
  let weeksHitTarget = 0;
  for (const cnt of weekCounts.values()) {
    if (cnt >= weeklyTarget) {
      weeksHitTarget++;
      points += rules.weeklyTargetBonus ?? 20;
    }
  }
  return { year, month, sessions: monthLogs.length, points, weeksHitTarget };
}

/** All-time totals, streaks, and best week for a single participant. */
export function getAllTimeStats(
  participantId: string,
  logs: ActivityLog[],
  rules: ChallengeScoringRules,
  weeklyTarget: number,
  todayStr: string,
): AllTimeStats {
  const myLogs = logs.filter(l => l.participantId === participantId);
  const sessions = myLogs.length;

  const weekCounts = new Map<string, number>();
  let points = 0;
  for (const log of myLogs) {
    const wk = weekKey(log.date);
    weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1);
    points += rules.pointsPerActivity;
    if (log.activityType === 'run') points += rules.runningBonus;
  }
  for (const cnt of weekCounts.values()) {
    if (cnt >= weeklyTarget) points += rules.weeklyTargetBonus ?? 20;
  }

  const bestWeekSessions = weekCounts.size > 0 ? Math.max(...weekCounts.values()) : 0;

  const thisWeek = weekKey(todayStr);
  const sortedPastWeeks = Array.from(weekCounts.entries())
    .filter(([wk]) => wk < thisWeek)
    .sort((a, b) => a[0].localeCompare(b[0]));

  let longestStreak = 0;
  let run = 0;
  for (const [, cnt] of sortedPastWeeks) {
    if (cnt >= weeklyTarget) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  run = 0;
  for (let i = sortedPastWeeks.length - 1; i >= 0; i--) {
    if (sortedPastWeeks[i][1] >= weeklyTarget) run++;
    else break;
  }

  return { sessions, points, bestWeekSessions, currentStreak: run, longestStreak };
}

/**
 * Returns the number of consecutive past complete weeks (most recent first)
 * in which ALL given participants hit the weekly target.
 * Used to drive the "you're both smashing it" smart suggestion.
 */
export function countBothHitTarget(
  participantIds: string[],
  logs: ActivityLog[],
  weeklyTarget: number,
  todayStr: string,
): number {
  if (participantIds.length < 2) return 0;
  const thisWeek = weekKey(todayStr);
  const allPastWeeks = new Set(
    logs.map(l => weekKey(l.date)).filter(wk => wk < thisWeek),
  );
  const sortedWeeks = Array.from(allPastWeeks).sort((a, b) => b.localeCompare(a));
  let count = 0;
  for (const wk of sortedWeeks) {
    const allHit = participantIds.every(pid => {
      const sessions = logs.filter(
        l => l.participantId === pid && weekKey(l.date) === wk,
      ).length;
      return sessions >= weeklyTarget;
    });
    if (allHit) count++;
    else break;
  }
  return count;
}
