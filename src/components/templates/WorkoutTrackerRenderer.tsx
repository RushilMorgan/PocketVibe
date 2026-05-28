import React, { useMemo, useState } from 'react';
import type {
  WorkoutTrackerContent,
  ChallengeParticipant,
  ActivityLog,
  ChallengeScoringRules,
  ActivityType,
  ColourTheme,
} from '../../types';
import { SmartGuidance } from '../SmartGuidance';
import { computeWorkoutGuidance } from '../../lib/guidance';
import { THEMES, getWorkoutGradient } from '../../lib/themes';

interface WorkoutTrackerRendererProps {
  content: WorkoutTrackerContent;
  onChange: (updated: WorkoutTrackerContent) => void;
  onShare?: () => void;
  hasShareLink?: boolean;
}

interface ParticipantScore {
  participant: ChallengeParticipant;
  points: number;
  sessionsThisWeek: number;
  totalSessions: number;
}

const ACTIVITY_ICON: Record<string, string> = {
  walk: '🚶',
  run: '🏃',
  gym: '💪',
  other: '⭐',
};

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

type ChallengeSheetView = null | 'logActivity' | 'manage' | 'participants' | 'scoring' | 'colours';

export function WorkoutTrackerRenderer({ content, onChange, onShare, hasShareLink = false }: WorkoutTrackerRendererProps) {
  const update = (patch: Partial<WorkoutTrackerContent>) => onChange({ ...content, ...patch });

  const [sheetView, setSheetView] = useState<ChallengeSheetView>(null);

  const [logParticipantId, setLogParticipantId] = useState('');
  const [logActivity, setLogActivity] = useState<ActivityType>('walk');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logDuration, setLogDuration] = useState('');
  const [logNote, setLogNote] = useState('');

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogDate, setEditLogDate] = useState('');
  const [editLogActivity, setEditLogActivity] = useState<ActivityType>('walk');
  const [editLogDuration, setEditLogDuration] = useState('');
  const [editLogNote, setEditLogNote] = useState('');

  const isChallenge = !!(content.challengeMode || (content.participants && content.participants.length > 0));
  if (!isChallenge) {
    return (
      <div className="p-4 text-sm text-gray-500">
        This renderer is optimized for Partner Challenge mode.
      </div>
    );
  }

  const participants = content.participants ?? [];
  const logs = content.logs ?? [];
  const activityTypes = content.activityTypes ?? ['walk', 'run', 'gym', 'other'];
  const weeklyTarget = content.weeklyTarget ?? 3;
  const rules: ChallengeScoringRules = content.scoringRules ?? {
    pointsPerActivity: 10,
    weeklyTargetBonus: 20,
    runningBonus: 5,
  };

  const today = new Date().toISOString().slice(0, 10);
  const ranked = useMemo(() => calcScores(participants, logs, rules, weeklyTarget, today), [participants, logs, rules, weeklyTarget, today]);
  const workoutGuidance = computeWorkoutGuidance(content, hasShareLink);

  const left = ranked[0];
  const right = ranked[1];
  const leaderLabel = left && right
    ? left.points === right.points
      ? 'It is tied right now'
      : `${left.participant.name} is leading`
    : left
      ? `${left.participant.name} is leading`
      : 'Add participants to start';

  function handleAction(id: string) {
    switch (id) {
      case 'add-partner':
      case 'set-target':
      case 'edit-points':
        setSheetView('manage');
        break;
      case 'log-activity':
        openLog();
        break;
      case 'change-theme':
        setSheetView('colours');
        break;
      case 'share':
        onShare?.();
        break;
    }
  }

  function openLog(participantId?: string, activityType?: ActivityType) {
    setLogParticipantId(participantId ?? (participants[0]?.id ?? ''));
    setLogActivity(activityType ?? 'walk');
    setLogDate(today);
    setLogDuration('');
    setLogNote('');
    setSheetView('logActivity');
  }

  function submitLog() {
    if (!logParticipantId) return;
    const newLog: ActivityLog = {
      id: `l-${Date.now()}`,
      participantId: logParticipantId,
      date: logDate,
      activityType: logActivity,
      duration: logDuration || undefined,
      note: logNote || undefined,
    };
    update({ logs: [...logs, newLog] });
    setSheetView(null);
  }

  function updateParticipantName(id: string, name: string) {
    update({ participants: participants.map(p => (p.id === id ? { ...p, name } : p)) });
  }

  function updateParticipantEmoji(id: string, emoji: string) {
    update({ participants: participants.map(p => (p.id === id ? { ...p, emoji } : p)) });
  }

  function addParticipant() {
    const id = `p-${Date.now()}`;
    update({ participants: [...participants, { id, name: 'New participant', emoji: '🏃' }] });
  }

  function deleteParticipant(id: string) {
    update({
      participants: participants.filter(p => p.id !== id),
      logs: logs.filter(l => l.participantId !== id),
    });
  }

  function deleteLog(id: string) {
    update({ logs: logs.filter(l => l.id !== id) });
  }

  function openEditLog(log: ActivityLog) {
    setEditingLogId(log.id);
    setEditLogDate(log.date);
    setEditLogActivity(log.activityType);
    setEditLogDuration(log.duration ?? '');
    setEditLogNote(log.note ?? '');
  }

  function saveEditLog() {
    if (!editingLogId) return;
    update({
      logs: logs.map(l =>
        l.id === editingLogId
          ? {
              ...l,
              date: editLogDate,
              activityType: editLogActivity,
              duration: editLogDuration || undefined,
              note: editLogNote || undefined,
            }
          : l,
      ),
    });
    setEditingLogId(null);
  }

  function updateRule<K extends keyof ChallengeScoringRules>(key: K, value: number) {
    update({ scoringRules: { ...rules, [key]: value } });
  }

  const recentLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  // ── Sheet content renderer ───────────────────────────────────────────────

  function renderSheetContent() {
    if (sheetView === 'logActivity') {
      return (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <h3 className="text-sm font-bold text-gray-900">Log activity</h3>
          <div data-testid="log-activity-form" className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-gray-500">Who</label>
              <select
                data-testid="log-participant-select"
                value={logParticipantId}
                onChange={e => setLogParticipantId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {participants.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji ?? ''} {p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 flex-wrap">
              {activityTypes.map(at => (
                <button
                  key={at}
                  data-testid={`log-type-${at}`}
                  onClick={() => setLogActivity(at as ActivityType)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${logActivity === at ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  {ACTIVITY_ICON[at] ?? '⭐'} {at}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input data-testid="log-date-input" type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              <input value={logDuration} onChange={e => setLogDuration(e.target.value)} placeholder="Duration (optional)" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <input value={logNote} onChange={e => setLogNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button data-testid="log-submit-btn" onClick={submitLog} className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white">Log it</button>
              <button onClick={() => setSheetView(null)} className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
            </div>
          </div>
        </>
      );
    }

    if (sheetView === 'manage') {
      return (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-black text-gray-900">Manage challenge</h3>
            <button onClick={() => setSheetView(null)} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">Done</button>
          </div>

          <section>
            <h4 className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Challenge name</h4>
            <input
              data-testid="challenge-name-input"
              value={content.planName}
              onChange={e => update({ planName: e.target.value })}
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </section>

          <section className="mt-4">
            <h4 className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Weekly target</h4>
            <div className="mt-2 flex items-center justify-between gap-3">
              <label className="text-sm text-gray-700">Sessions per week</label>
              <input
                data-testid="weekly-target-input"
                type="number"
                min={1}
                max={14}
                value={weeklyTarget}
                onChange={e => update({ weeklyTarget: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm"
              />
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              data-testid="participants-nav-btn"
              onClick={() => setSheetView('participants')}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
            >
              👥 Participants
            </button>
            <button
              data-testid="scoring-nav-btn"
              onClick={() => setSheetView('scoring')}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
            >
              📊 Scoring
            </button>
            <button
              data-testid="colours-nav-btn"
              onClick={() => setSheetView('colours')}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
            >
              🎨 Colours
            </button>
            <button
              onClick={() => onShare?.()}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
            >
              🔗 Share
            </button>
          </div>
        </>
      );
    }

    if (sheetView === 'participants') {
      return (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setSheetView('manage')}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 active:bg-gray-200"
            >
              ← Back
            </button>
            <h3 className="flex-1 text-base font-black text-gray-900">Participants</h3>
          </div>
          <div className="space-y-2">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <input value={p.emoji ?? ''} onChange={e => updateParticipantEmoji(p.id, e.target.value)} className="w-10 rounded-lg border border-gray-200 px-1 py-1.5 text-center text-sm" />
                <input data-testid={`participant-name-input-${p.id}`} value={p.name} onChange={e => updateParticipantName(p.id, e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                <button data-testid={`delete-participant-${p.id}`} onClick={() => deleteParticipant(p.id)} className="text-red-500">×</button>
              </div>
            ))}
            <button data-testid="add-participant-btn" onClick={addParticipant} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700">+ Add participant</button>
          </div>
        </>
      );
    }

    if (sheetView === 'scoring') {
      return (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setSheetView('manage')}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 active:bg-gray-200"
            >
              ← Back
            </button>
            <h3 className="flex-1 text-base font-black text-gray-900">Scoring</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm text-gray-700">Points per activity</label>
              <input
                data-testid="points-per-activity-input"
                type="number"
                value={rules.pointsPerActivity}
                onChange={e => updateRule('pointsPerActivity', parseInt(e.target.value) || 0)}
                className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm text-gray-700">Weekly target bonus</label>
              <input
                data-testid="weekly-target-bonus-input"
                type="number"
                value={rules.weeklyTargetBonus}
                onChange={e => updateRule('weeklyTargetBonus', parseInt(e.target.value) || 0)}
                className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm text-gray-700">Running bonus</label>
              <input
                data-testid="running-bonus-input"
                type="number"
                value={rules.runningBonus}
                onChange={e => updateRule('runningBonus', parseInt(e.target.value) || 0)}
                className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm"
              />
            </div>
          </div>
        </>
      );
    }

    if (sheetView === 'colours') {
      return (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setSheetView('manage')}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 active:bg-gray-200"
            >
              ← Back
            </button>
            <h3 className="flex-1 text-base font-black text-gray-900">Challenge colours</h3>
          </div>
          <div data-testid="challenge-colours-view" className="flex flex-wrap gap-3">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                data-testid={`theme-${theme.id}`}
                onClick={() => {
                  update({ colourTheme: theme.id as ColourTheme });
                  setSheetView('manage');
                }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${theme.gradient} ${content.colourTheme === theme.id ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`} />
                <span className="text-xs text-gray-600">{theme.label}</span>
              </button>
            ))}
          </div>
        </>
      );
    }

    return null;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className={`rounded-3xl bg-gradient-to-br ${getWorkoutGradient(content.colourTheme)} p-5 text-white shadow-lg`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black">{content.planName}</h2>
            <p className="mt-0.5 text-xs opacity-90">Week target: {weeklyTarget}</p>
            <p className="mt-0.5 text-xs opacity-80">{leaderLabel}</p>
          </div>
          <button
            data-testid="edit-challenge-btn"
            onClick={() => setSheetView('manage')}
            className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white active:bg-white/30"
          >
            Manage challenge
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/15 p-3 text-xs">
            <p className="opacity-80">{left?.participant.name ?? 'Player 1'}</p>
            <p className="text-base font-black">{left?.points ?? 0} pts</p>
            <p className="opacity-80">{left?.sessionsThisWeek ?? 0}/{weeklyTarget}</p>
          </div>
          <div className="rounded-xl bg-white/15 p-3 text-xs">
            <p className="opacity-80">{right?.participant.name ?? 'Player 2'}</p>
            <p className="text-base font-black">{right?.points ?? 0} pts</p>
            <p className="opacity-80">{right?.sessionsThisWeek ?? 0}/{weeklyTarget}</p>
          </div>
        </div>
      </div>

      <SmartGuidance guidance={workoutGuidance} onAction={handleAction} />

      <button
        data-testid="log-activity-btn"
        onClick={() => openLog()}
        className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white active:bg-black"
      >
        + Log activity
      </button>

      <div className="grid gap-3">
        {ranked.map(score => {
          const latest = logs.find(l => l.participantId === score.participant.id);
          return (
            <div key={score.participant.id} className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{score.participant.emoji ?? '🏃'} {score.participant.name}</p>
                  <p className="text-xs text-gray-500">Latest: {latest ? `${latest.activityType} on ${latest.date}` : 'No activity yet'}</p>
                </div>
                <div className="text-right">
                  <p data-testid={`participant-score-${score.participant.id}`} className="text-lg font-black text-gray-900">{score.points}</p>
                  <p className="text-xs text-gray-500">pts</p>
                </div>
              </div>
              <div data-testid={`weekly-progress-${score.participant.id}`} className="mt-2 text-xs text-gray-500">
                {score.sessionsThisWeek}/{weeklyTarget} this week
              </div>
              <div className="mt-1 flex gap-1">
                {Array.from({ length: Math.min(weeklyTarget, 7) }).map((_, i) => (
                  <div
                    key={`${score.participant.id}-${i}`}
                    className={`h-1.5 w-full rounded-full ${i < score.sessionsThisWeek ? 'bg-emerald-500' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {recentLogs.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <h3 className="text-sm font-bold text-gray-900">Recent activity</h3>
          <div className="mt-2 space-y-1.5">
            {recentLogs.map(log => {
              const p = participants.find(x => x.id === log.participantId);
              if (editingLogId === log.id) {
                return (
                  <div key={log.id} data-testid={`edit-log-row-${log.id}`} className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {activityTypes.map(at => (
                        <button
                          key={`${log.id}-${at}`}
                          data-testid={`edit-log-type-${log.id}-${at}`}
                          onClick={() => setEditLogActivity(at as ActivityType)}
                          className={`rounded-full px-2.5 py-1 text-xs ${editLogActivity === at ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                        >
                          {at}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input data-testid={`edit-log-date-${log.id}`} type="date" value={editLogDate} onChange={e => setEditLogDate(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                      <input data-testid={`edit-log-duration-${log.id}`} value={editLogDuration} onChange={e => setEditLogDuration(e.target.value)} placeholder="Duration" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                    </div>
                    <input data-testid={`edit-log-note-${log.id}`} value={editLogNote} onChange={e => setEditLogNote(e.target.value)} placeholder="Note" className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                    <div className="flex gap-2">
                      <button data-testid={`save-edit-log-${log.id}`} onClick={saveEditLog} className="flex-1 rounded-lg bg-gray-900 py-1.5 text-xs font-semibold text-white">Save</button>
                      <button data-testid={`delete-log-${log.id}`} onClick={() => deleteLog(log.id)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">Delete</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={log.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                  <span className="text-sm">{ACTIVITY_ICON[log.activityType] ?? '⭐'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-800">{p?.name ?? 'Unknown'} · {log.activityType}</p>
                    <p className="text-xs text-gray-500">{log.date}{log.duration ? ` · ${log.duration}` : ''}{log.note ? ` · ${log.note}` : ''}</p>
                  </div>
                  <button data-testid={`edit-log-open-${log.id}`} onClick={() => openEditLog(log)} className="rounded-lg px-2 py-1 text-xs text-blue-600 active:bg-blue-50">Edit</button>
                  <button data-testid={`delete-log-${log.id}`} onClick={() => deleteLog(log.id)} className="text-red-500">×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Single manage sheet — all sub-views rendered here */}
      {sheetView !== null && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setSheetView(null)}>
          <div className="absolute inset-0 bg-black/35" />
          <div
            data-testid="manage-challenge-sheet"
            className="relative z-10 max-h-[84dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4"
            onClick={e => e.stopPropagation()}
          >
            {renderSheetContent()}
          </div>
        </div>
      )}
    </div>
  );
}
