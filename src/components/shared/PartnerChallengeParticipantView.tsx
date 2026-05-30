/**
 * Participant-specific view for a shared Partner Challenge.
 * Shows own stats, log activity form, own logs (editable/deletable), and the full leaderboard.
 * Does NOT expose scoring rules editing, participants management, or other people's detailed logs.
 */
import React, { useState } from 'react';
import type {
  WorkoutTrackerContent,
  ActivityType,
  ActivityLog,
  ChallengeParticipant,
  ChallengeScoringRules,
} from '../../types';
import { applyCreationAction } from '../../services/shareService';

interface Props {
  content: WorkoutTrackerContent;
  participantRef: string;
  shareSlug: string;
  token: string;
  onUpdate: (updated: WorkoutTrackerContent, version: number) => void;
}

const ACTIVITY_ICON: Record<string, string> = {
  walk: '🚶',
  run: '🏃',
  gym: '💪',
  other: '⭐',
};

// ── Score helpers ─────────────────────────────────────────────────────────────

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

interface ParticipantScore {
  participant: ChallengeParticipant;
  points: number;
  sessionsThisWeek: number;
  totalSessions: number;
}

function calcScores(
  participants: ChallengeParticipant[],
  logs: ActivityLog[],
  rules: ChallengeScoringRules,
  weeklyTarget: number,
  todayStr: string,
): ParticipantScore[] {
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

const MEDAL = ['🥇', '🥈', '🥉'];

// ── Component ─────────────────────────────────────────────────────────────────

export function PartnerChallengeParticipantView({ content, participantRef, shareSlug, token, onUpdate }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [logOpen, setLogOpen] = useState(false);
  const [logActivity, setLogActivity] = useState<ActivityType>('walk');
  const [logDate, setLogDate] = useState(today);
  const [logDuration, setLogDuration] = useState('');
  const [logNote, setLogNote] = useState('');

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editActivity, setEditActivity] = useState<ActivityType>('walk');
  const [editDate, setEditDate] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editNote, setEditNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const participants = content.participants ?? [];
  const logs = content.logs ?? [];
  const rules: ChallengeScoringRules = content.scoringRules ?? {
    pointsPerActivity: 10,
    weeklyTargetBonus: 20,
    runningBonus: 5,
  };
  const weeklyTarget = content.weeklyTarget ?? 3;
  const activityTypes = (content.activityTypes ?? ['walk', 'run', 'gym', 'other']) as ActivityType[];

  const me = participants.find(p => p.id === participantRef);
  const myLogs = logs.filter(l => l.participantId === participantRef).sort((a, b) => b.date.localeCompare(a.date));
  const allScores = calcScores(participants, logs, rules, weeklyTarget, today);
  const myRank = allScores.findIndex(s => s.participant.id === participantRef) + 1;
  const myScore = allScores.find(s => s.participant.id === participantRef);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function runAction(action: string, payload: Record<string, unknown>) {
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await applyCreationAction(shareSlug, token, action, payload);
      onUpdate(result.content as WorkoutTrackerContent, result.version);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed. Please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitLog() {
    const ok = await runAction('log_activity', {
      participantId: participantRef,
      date: logDate,
      activityType: logActivity,
      duration: logDuration || undefined,
      note: logNote || undefined,
    });
    if (ok) {
      setLogOpen(false);
      setLogDuration('');
      setLogNote('');
      setLogDate(today);
    }
  }

  async function submitEditLog() {
    if (!editingLogId) return;
    const ok = await runAction('edit_own_log', {
      logId: editingLogId,
      date: editDate,
      activityType: editActivity,
      duration: editDuration || undefined,
      note: editNote || undefined,
    });
    if (ok) setEditingLogId(null);
  }

  async function deleteLog(logId: string) {
    await runAction('delete_own_log', { logId });
  }

  function openEditLog(log: ActivityLog) {
    setEditingLogId(log.id);
    setEditActivity(log.activityType);
    setEditDate(log.date);
    setEditDuration(log.duration ?? '');
    setEditNote(log.note ?? '');
    setActionError(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Challenge header — dark charcoal + emerald */}
      <div className="relative rounded-2xl overflow-hidden ring-1 ring-emerald-400/30 shadow-lg">
        <div className="relative bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 p-5 overflow-hidden">
          {/* Track arc decoration */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-64 h-16 rounded-full border border-white/8 pointer-events-none" />
          {/* 🏃 watermark */}
          <div className="absolute -right-2 top-1 text-6xl opacity-5 pointer-events-none select-none">🏃</div>
          <div className="relative z-10 flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
              <span className="text-xs text-white/60 font-semibold tracking-wide uppercase">Partner Challenge</span>
            </div>
            <span className="text-xs font-black bg-emerald-400 text-gray-900 px-2.5 py-1 rounded-full tracking-widest uppercase">
              Fitness ⚡
            </span>
          </div>
          <h2 className="relative z-10 text-xl font-black text-white mt-3">{content.planName}</h2>
          <p className="relative z-10 text-emerald-400 text-xs font-semibold mt-0.5">
            Target: {weeklyTarget} session{weeklyTarget !== 1 ? 's' : ''}/week
          </p>
          <p className="relative z-10 text-xs text-white/50 mt-0.5">
            {rules.pointsPerActivity} pts · Run bonus +{rules.runningBonus} · Weekly target +{rules.weeklyTargetBonus}
          </p>
        </div>
      </div>

      {/* My stats */}
      {me && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your stats</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{me.emoji ?? '🏃'}</span>
            <div>
              <p className="font-semibold text-gray-800">{me.name}</p>
              <p className="text-xs text-gray-500">
                Rank #{myRank} of {participants.length} · {myScore?.points ?? 0} pts
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-xl font-bold text-gray-800">{myScore?.points ?? 0}</p>
              <p className="text-xs text-gray-500">Points</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-xl font-bold text-gray-800">{myScore?.sessionsThisWeek ?? 0}</p>
              <p className="text-xs text-gray-500">This week</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-xl font-bold text-gray-800">{myScore?.totalSessions ?? 0}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
          <button
            data-testid="log-activity-btn"
            onClick={() => { setLogOpen(true); setActionError(null); }}
            disabled={submitting}
            className="mt-3 w-full bg-emerald-400 text-gray-900 text-sm font-black rounded-xl py-2.5 active:bg-emerald-300 disabled:opacity-50"
          >
            + Log activity
          </button>
        </div>
      )}

      {/* Log activity form */}
      {logOpen && (
        <div data-testid="log-activity-form" className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Log Activity</h3>
          {actionError && <p className="text-xs text-red-500 mb-2">{actionError}</p>}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Activity</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {activityTypes.map(at => (
                  <button
                    key={at}
                    onClick={() => setLogActivity(at)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      logActivity === at ? 'bg-emerald-400 text-gray-900' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                    }`}
                  >
                    {ACTIVITY_ICON[at] ?? '⭐'} {at}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Duration (optional)</label>
                <input
                  value={logDuration}
                  onChange={e => setLogDuration(e.target.value)}
                  placeholder="e.g. 30 min"
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Note (optional)</label>
              <input
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
                placeholder="How did it go?"
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                data-testid="log-submit-btn"
                onClick={submitLog}
                disabled={submitting}
                className="flex-1 bg-emerald-400 text-gray-900 text-sm font-black rounded-xl py-2.5 active:bg-emerald-300 disabled:opacity-50"
              >
                {submitting ? 'Logging…' : 'Log it'}
              </button>
              <button
                onClick={() => { setLogOpen(false); setActionError(null); }}
                className="px-4 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl py-2.5 active:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My logs */}
      {myLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your logs</p>
          {actionError && !logOpen && <p className="text-xs text-red-500 mb-2">{actionError}</p>}
          <div className="space-y-1">
            {myLogs.slice(0, 12).map(log => (
              <div key={log.id}>
                {editingLogId === log.id ? (
                  <div className="p-3 bg-gray-50 rounded-xl space-y-2 mb-1">
                    <div className="flex gap-2 flex-wrap">
                      {activityTypes.map(at => (
                        <button
                          key={at}
                          onClick={() => setEditActivity(at)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            editActivity === at ? 'bg-emerald-400 text-gray-900' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {ACTIVITY_ICON[at] ?? '⭐'} {at}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                      <input
                        value={editDuration}
                        onChange={e => setEditDuration(e.target.value)}
                        placeholder="Duration"
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    <input
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      placeholder="Note"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={submitEditLog}
                        disabled={submitting}
                        className="flex-1 text-xs bg-emerald-400 text-gray-900 rounded-lg py-1.5 font-black disabled:opacity-50"
                      >
                        {submitting ? '…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingLogId(null)}
                        className="flex-1 text-xs bg-gray-200 text-gray-600 rounded-lg py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{ACTIVITY_ICON[log.activityType] ?? '⭐'}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800 capitalize">{log.activityType}</p>
                        <p className="text-xs text-gray-400">
                          {log.date}{log.duration ? ` · ${log.duration}` : ''}{log.note ? ` · ${log.note}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => openEditLog(log)}
                        className="text-xs text-gray-400 px-2 py-1.5 rounded-lg active:bg-gray-100"
                        aria-label="Edit log"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteLog(log.id)}
                        disabled={submitting}
                        className="text-xs text-red-400 px-2 py-1.5 rounded-lg active:bg-red-50 disabled:opacity-50"
                        aria-label="Delete log"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full leaderboard (read-only) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Leaderboard</p>
        <div className="space-y-2">
          {allScores.map((score, i) => (
            <div
              key={score.participant.id}
              className={`flex items-center gap-3 py-2 px-3 rounded-xl ${
                score.participant.id === participantRef ? 'bg-emerald-50' : ''
              }`}
            >
              <span className="text-lg w-6 text-center flex-shrink-0">
                {i < 3 ? MEDAL[i] : `#${i + 1}`}
              </span>
              <span className="text-xl flex-shrink-0">{score.participant.emoji ?? '🏃'}</span>
              <span className="flex-1 text-sm font-medium text-gray-800 min-w-0 truncate">
                {score.participant.name}
                {score.participant.id === participantRef && (
                  <span className="ml-1 text-xs text-emerald-500">(you)</span>
                )}
              </span>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-gray-800">{score.points} pts</p>
                <p className="text-xs text-gray-400">{score.sessionsThisWeek}/{weeklyTarget} this wk</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring rules (read-only) */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">How points work</p>
        <div className="space-y-1 text-xs text-gray-600">
          <p>✓ {rules.pointsPerActivity} pts per activity logged</p>
          <p>🏃 +{rules.runningBonus} pts bonus for a run</p>
          <p>🎯 +{rules.weeklyTargetBonus} pts for hitting your weekly target ({weeklyTarget} sessions)</p>
        </div>
      </div>
    </div>
  );
}
