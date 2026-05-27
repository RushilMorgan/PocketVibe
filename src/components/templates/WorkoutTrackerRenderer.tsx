import React, { useState } from 'react';
import type {
  WorkoutTrackerContent,
  WorkoutExercise,
  ChallengeParticipant,
  ActivityLog,
  ChallengeScoringRules,
  ActivityType,
} from '../../types';

interface WorkoutTrackerRendererProps {
  content: WorkoutTrackerContent;
  onChange: (updated: WorkoutTrackerContent) => void;
}

// ── Score calculation — pure, never stored ────────────────────────────────────

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
  return participants.map(p => {
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
    const sessionsThisWeek = weekCounts.get(thisWeek) ?? 0;
    return { participant: p, points, sessionsThisWeek, totalSessions: myLogs.length };
  });
}

// ── Activity icon map ─────────────────────────────────────────────────────────

const ACTIVITY_ICON: Record<string, string> = {
  walk: '🚶',
  run: '🏃',
  gym: '💪',
  other: '⭐',
};

// ── Basic workout renderer (legacy days-based mode) ───────────────────────────

function BasicWorkoutRenderer({ content, onChange }: WorkoutTrackerRendererProps) {
  const [editMode, setEditMode] = useState(false);
  const days = content.days ?? [];
  const completedDays = days.filter(d => d.completed).length;

  function toggleDay(id: string) {
    onChange({ ...content, days: days.map(d => d.id === id ? { ...d, completed: !d.completed } : d) });
  }

  function updateDay(id: string, label: string) {
    onChange({ ...content, days: days.map(d => d.id === id ? { ...d, label } : d) });
  }

  function updateExercise(dayId: string, exId: string, patch: Partial<WorkoutExercise>) {
    onChange({
      ...content,
      days: days.map(d =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.map(e => e.id === exId ? { ...e, ...patch } : e) }
          : d,
      ),
    });
  }

  function addExercise(dayId: string) {
    const id = `e-${Date.now()}`;
    onChange({
      ...content,
      days: days.map(d =>
        d.id === dayId
          ? { ...d, exercises: [...d.exercises, { id, name: 'New exercise', sets: 3, reps: '10' }] }
          : d,
      ),
    });
  }

  function deleteExercise(dayId: string, exId: string) {
    onChange({
      ...content,
      days: days.map(d =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter(e => e.id !== exId) }
          : d,
      ),
    });
  }

  function addDay() {
    const id = `d-${Date.now()}`;
    const num = days.length + 1;
    onChange({ ...content, days: [...days, { id, label: `Day ${num}`, exercises: [], completed: false }] });
  }

  function deleteDay(id: string) {
    onChange({ ...content, days: days.filter(d => d.id !== id) });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl p-5 text-white">
        <h2 className="text-xl font-bold">{content.planName}</h2>
        <p className="text-sm opacity-90 mt-1">{completedDays}/{days.length} days completed</p>
        <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: days.length > 0 ? `${Math.round((completedDays / days.length) * 100)}%` : '0%' }}
          />
        </div>
      </div>

      {/* Edit toggle */}
      <div className="flex justify-end">
        <button
          data-testid="edit-workout-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            editMode ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : 'Edit workout'}
        </button>
      </div>

      {/* Days */}
      {days.map(day => (
        <div key={day.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            {editMode ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  value={day.label}
                  onChange={e => updateDay(day.id, e.target.value)}
                  className="flex-1 text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <button
                  onClick={() => deleteDay(day.id)}
                  className="text-red-400 hover:text-red-600 p-1"
                  aria-label="Delete day"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => toggleDay(day.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  day.completed ? 'bg-red-500 border-red-500' : 'border-gray-300'
                }`}>
                  {day.completed && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <h3 className={`font-semibold text-sm ${day.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {day.label}
                </h3>
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {day.exercises.map(ex => (
              <div key={ex.id} className="px-4 py-3">
                {editMode ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        data-testid={`exercise-name-${ex.id}`}
                        value={ex.name}
                        onChange={e => updateExercise(day.id, ex.id, { name: e.target.value })}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                        placeholder="Exercise name"
                      />
                      <button
                        data-testid={`delete-exercise-${ex.id}`}
                        onClick={() => deleteExercise(day.id, ex.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                        aria-label="Delete exercise"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">Sets</label>
                        <input
                          data-testid={`exercise-sets-${ex.id}`}
                          type="number"
                          min={0}
                          value={ex.sets ?? ''}
                          onChange={e => updateExercise(day.id, ex.id, { sets: parseInt(e.target.value) || undefined })}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Reps</label>
                        <input
                          value={ex.reps ?? ''}
                          onChange={e => updateExercise(day.id, ex.id, { reps: e.target.value })}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                          placeholder="e.g. 10-12"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Duration</label>
                        <input
                          value={ex.duration ?? ''}
                          onChange={e => updateExercise(day.id, ex.id, { duration: e.target.value })}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                          placeholder="e.g. 30s"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-800">{ex.name}</span>
                    <span className="text-xs text-gray-400">
                      {ex.sets != null && ex.reps ? `${ex.sets} × ${ex.reps}` :
                       ex.duration ?? (ex.sets ? `${ex.sets} sets` : '')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {editMode && (
            <div className="px-4 pb-4 pt-2">
              <button
                data-testid="add-exercise-btn"
                onClick={() => addExercise(day.id)}
                className="w-full text-sm text-red-500 font-semibold border-2 border-dashed border-red-200 rounded-xl py-2 active:bg-red-50 transition-colors"
              >
                + Add exercise
              </button>
            </div>
          )}
        </div>
      ))}

      {editMode && (
        <button
          onClick={addDay}
          className="w-full text-sm text-red-500 font-semibold border-2 border-dashed border-red-200 rounded-2xl py-3 active:bg-red-50 transition-colors"
        >
          + Add day
        </button>
      )}
    </div>
  );
}

// ── Challenge mode renderer ────────────────────────────────────────────────────

export function WorkoutTrackerRenderer({ content, onChange }: WorkoutTrackerRendererProps) {
  const [editMode, setEditMode] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logParticipantId, setLogParticipantId] = useState('');
  const [logActivity, setLogActivity] = useState<ActivityType>('walk');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logDuration, setLogDuration] = useState('');
  const [logDistance, setLogDistance] = useState('');
  const [logNote, setLogNote] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogDate, setEditLogDate] = useState('');
  const [editLogActivity, setEditLogActivity] = useState<ActivityType>('walk');
  const [editLogDuration, setEditLogDuration] = useState('');
  const [editLogNote, setEditLogNote] = useState('');

  const isChallenge = !!(content.challengeMode || (content.participants && content.participants.length > 0));

  if (!isChallenge) {
    return <BasicWorkoutRenderer content={content} onChange={onChange} />;
  }

  // Challenge mode — all fields have safe defaults
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
  const allScores = calcScores(participants, logs, rules, weeklyTarget, today);
  const ranked = [...allScores].sort((a, b) => b.points - a.points);
  const recentLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  function update(patch: Partial<WorkoutTrackerContent>) {
    onChange({ ...content, ...patch });
  }

  function updateParticipantName(id: string, name: string) {
    update({ participants: participants.map(p => p.id === id ? { ...p, name } : p) });
  }

  function updateParticipantEmoji(id: string, emoji: string) {
    update({ participants: participants.map(p => p.id === id ? { ...p, emoji } : p) });
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

  function openLog(participantId?: string, activityType?: ActivityType) {
    setLogParticipantId(participantId ?? (participants[0]?.id ?? ''));
    setLogActivity(activityType ?? 'walk');
    setLogDate(today);
    setLogDuration('');
    setLogDistance('');
    setLogNote('');
    setLogOpen(true);
  }

  function submitLog() {
    if (!logParticipantId) return;
    const newLog: ActivityLog = {
      id: `l-${Date.now()}`,
      participantId: logParticipantId,
      date: logDate,
      activityType: logActivity,
      duration: logDuration || undefined,
      distance: logDistance || undefined,
      note: logNote || undefined,
    };
    update({ logs: [...logs, newLog] });
    setLogOpen(false);
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
          ? { ...l, date: editLogDate, activityType: editLogActivity, duration: editLogDuration || undefined, note: editLogNote || undefined }
          : l,
      ),
    });
    setEditingLogId(null);
  }

  function updateRule<K extends keyof ChallengeScoringRules>(key: K, value: number) {
    update({ scoringRules: { ...rules, [key]: value } });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl p-5 text-white">
        <h2 className="text-xl font-bold">{content.planName}</h2>
        <p className="text-sm opacity-90 mt-1">
          Target: {weeklyTarget} session{weeklyTarget !== 1 ? 's' : ''}/week · {rules.pointsPerActivity} pts each
        </p>
        <p className="text-xs opacity-75 mt-0.5">
          Run bonus: +{rules.runningBonus} pts · Hit target: +{rules.weeklyTargetBonus} pts
        </p>
      </div>

      {/* ── Log Activity Form (inline) ── */}
      {logOpen && (
        <div data-testid="log-activity-form" className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Log Activity</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Who</label>
              <select
                data-testid="log-participant-select"
                value={logParticipantId}
                onChange={e => setLogParticipantId(e.target.value)}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {participants.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji ?? ''} {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Activity</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {activityTypes.map(at => (
                  <button
                    key={at}
                    data-testid={`log-type-${at}`}
                    onClick={() => setLogActivity(at as ActivityType)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      logActivity === at ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
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
                  data-testid="log-date-input"
                  type="date"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Duration (optional)</label>
                <input
                  value={logDuration}
                  onChange={e => setLogDuration(e.target.value)}
                  placeholder="e.g. 30 min"
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Note (optional)</label>
              <input
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
                placeholder="How did it go?"
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                data-testid="log-submit-btn"
                onClick={submitLog}
                className="flex-1 bg-red-500 text-white text-sm font-semibold rounded-xl py-2.5 active:bg-red-600"
              >
                Log it
              </button>
              <button
                onClick={() => setLogOpen(false)}
                className="px-4 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl py-2.5 active:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leaderboard ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Leaderboard</h3>
          <button
            data-testid="log-activity-btn"
            onClick={() => openLog()}
            className="text-xs font-semibold text-red-500 bg-red-50 px-3 py-1.5 rounded-full active:bg-red-100"
          >
            + Log activity
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {ranked.map((s, i) => (
            <div key={s.participant.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-gray-300 w-5 text-center">{i + 1}</span>
                <span className="text-xl">{s.participant.emoji ?? '🏃'}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{s.participant.name}</p>
                  <div
                    data-testid={`weekly-progress-${s.participant.id}`}
                    className="flex items-center gap-1.5 mt-1"
                  >
                    {Array.from({ length: Math.min(weeklyTarget, 7) }).map((_, j) => (
                      <div
                        key={j}
                        className={`h-1.5 w-6 rounded-full transition-colors ${
                          j < s.sessionsThisWeek ? 'bg-red-500' : 'bg-gray-100'
                        }`}
                      />
                    ))}
                    <span className="text-xs text-gray-400 ml-1">
                      {s.sessionsThisWeek}/{weeklyTarget} this week
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    data-testid={`participant-score-${s.participant.id}`}
                    className="text-base font-bold text-red-500"
                  >
                    {s.points}
                  </span>
                  <p className="text-xs text-gray-400">pts</p>
                </div>
              </div>
              {/* Quick log buttons per participant */}
              {!editMode && !logOpen && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {activityTypes.slice(0, 4).map(at => (
                    <button
                      key={at}
                      data-testid={`quick-log-${s.participant.id}-${at}`}
                      onClick={() => openLog(s.participant.id, at as ActivityType)}
                      className="text-xs px-2.5 py-1 bg-gray-50 text-gray-600 rounded-full active:bg-gray-100 transition-colors"
                    >
                      {ACTIVITY_ICON[at] ?? '⭐'} {at}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {participants.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Add participants to get started
            </div>
          )}
        </div>
      </div>

      {/* ── Recent activity ── */}
      {recentLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">Recent activity</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {recentLogs.map(log => {
              const p = participants.find(x => x.id === log.participantId);
              if (editMode && editingLogId === log.id) {
                return (
                  <div key={log.id} data-testid={`edit-log-row-${log.id}`} className="px-4 py-3 space-y-2 bg-gray-50">
                    <div className="flex gap-2 flex-wrap">
                      {activityTypes.map(at => (
                        <button
                          key={at}
                          data-testid={`edit-log-type-${log.id}-${at}`}
                          onClick={() => setEditLogActivity(at as ActivityType)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            editLogActivity === at ? 'bg-red-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
                          }`}
                        >
                          {ACTIVITY_ICON[at] ?? '⭐'} {at}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Date</label>
                        <input
                          data-testid={`edit-log-date-${log.id}`}
                          type="date"
                          value={editLogDate}
                          onChange={e => setEditLogDate(e.target.value)}
                          className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Duration</label>
                        <input
                          data-testid={`edit-log-duration-${log.id}`}
                          value={editLogDuration}
                          onChange={e => setEditLogDuration(e.target.value)}
                          placeholder="e.g. 30 min"
                          className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Note</label>
                      <input
                        data-testid={`edit-log-note-${log.id}`}
                        value={editLogNote}
                        onChange={e => setEditLogNote(e.target.value)}
                        placeholder="How did it go?"
                        className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        data-testid={`save-edit-log-${log.id}`}
                        onClick={saveEditLog}
                        className="flex-1 bg-red-500 text-white text-xs font-semibold rounded-xl py-2 active:bg-red-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingLogId(null)}
                        className="px-3 bg-gray-100 text-gray-600 text-xs font-medium rounded-xl py-2 active:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        data-testid={`delete-log-${log.id}`}
                        onClick={() => deleteLog(log.id)}
                        className="px-3 bg-red-50 text-red-500 text-xs font-medium rounded-xl py-2 active:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={log.id}
                  className="flex items-center px-4 py-2.5 gap-3"
                >
                  <span className="text-sm">{ACTIVITY_ICON[log.activityType] ?? '⭐'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">
                      <span className="font-medium">{p?.name ?? 'Unknown'}</span>
                      {' '}<span className="text-gray-500">· {log.activityType}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {log.date}{log.duration ? ` · ${log.duration}` : ''}{log.note ? ` · ${log.note}` : ''}
                    </p>
                  </div>
                  {editMode && (
                    <>
                      <button
                        data-testid={`edit-log-open-${log.id}`}
                        onClick={() => openEditLog(log)}
                        className="text-blue-400 hover:text-blue-600 text-xs font-medium px-2 py-1 rounded-lg active:bg-blue-50 flex-shrink-0"
                        aria-label="Edit log"
                      >
                        Edit
                      </button>
                      <button
                        data-testid={`delete-log-${log.id}`}
                        onClick={() => deleteLog(log.id)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none p-1 flex-shrink-0"
                        aria-label="Delete log"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Edit Challenge button ── */}
      <div className="flex justify-end">
        <button
          data-testid="edit-challenge-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            editMode ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : 'Edit challenge'}
        </button>
      </div>

      {/* ── Edit panel ── */}
      {editMode && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-5">
          {/* Challenge name */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Challenge name</h4>
            <input
              data-testid="challenge-name-input"
              value={content.planName}
              onChange={e => update({ planName: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Challenge name"
            />
          </div>

          {/* Participants */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Participants</h4>
            <div className="space-y-2">
              {participants.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    value={p.emoji ?? ''}
                    onChange={e => updateParticipantEmoji(p.id, e.target.value)}
                    className="w-10 text-center text-sm border border-gray-200 rounded-lg px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="😀"
                    maxLength={2}
                    aria-label="Participant emoji"
                  />
                  <input
                    data-testid={`participant-name-input-${p.id}`}
                    value={p.name}
                    onChange={e => updateParticipantName(p.id, e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Name"
                  />
                  <button
                    data-testid={`delete-participant-${p.id}`}
                    onClick={() => deleteParticipant(p.id)}
                    className="text-red-400 hover:text-red-600 text-lg leading-none p-1 flex-shrink-0"
                    aria-label="Remove participant"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                data-testid="add-participant-btn"
                onClick={addParticipant}
                className="w-full text-sm text-red-500 font-semibold border-2 border-dashed border-red-200 rounded-xl py-2 active:bg-red-50 transition-colors"
              >
                + Add participant
              </button>
            </div>
          </div>

          {/* Weekly goal */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Weekly goal</h4>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700 flex-1">Sessions per week</label>
              <input
                data-testid="weekly-target-input"
                type="number"
                min={1}
                max={14}
                value={weeklyTarget}
                onChange={e => update({ weeklyTarget: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>

          {/* Activity types */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Activity types</h4>
            <div className="flex flex-wrap gap-1.5">
              {['walk', 'run', 'gym', 'other'].map(at => {
                const active = activityTypes.includes(at);
                return (
                  <button
                    key={at}
                    data-testid={`activity-type-toggle-${at}`}
                    onClick={() => {
                      const next = active ? activityTypes.filter(x => x !== at) : [...activityTypes, at];
                      update({ activityTypes: next.length > 0 ? next : activityTypes });
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      active ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {ACTIVITY_ICON[at] ?? '⭐'} {at}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scoring rules */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Points</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Points per activity</label>
                <input
                  data-testid="points-per-activity-input"
                  type="number"
                  min={0}
                  value={rules.pointsPerActivity}
                  onChange={e => updateRule('pointsPerActivity', parseInt(e.target.value) || 0)}
                  className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Weekly target bonus</label>
                <input
                  data-testid="weekly-target-bonus-input"
                  type="number"
                  min={0}
                  value={rules.weeklyTargetBonus}
                  onChange={e => updateRule('weeklyTargetBonus', parseInt(e.target.value) || 0)}
                  className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Running bonus</label>
                <input
                  data-testid="running-bonus-input"
                  type="number"
                  min={0}
                  value={rules.runningBonus}
                  onChange={e => updateRule('runningBonus', parseInt(e.target.value) || 0)}
                  className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

