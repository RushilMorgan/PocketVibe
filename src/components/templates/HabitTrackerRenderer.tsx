import React, { useState } from 'react';
import type { HabitTrackerContent, Habit } from '../../types';

interface HabitTrackerRendererProps {
  content: HabitTrackerContent;
  onChange: (updated: HabitTrackerContent) => void;
}

interface DayInfo {
  date: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
}

function getLast7Days(): DayInfo[] {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayStr = new Date().toISOString().slice(0, 10);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      dayLabel: DAYS[d.getDay()],
      dateLabel: String(d.getDate()),
      isToday: date === todayStr,
    };
  });
}

function getStreak(completions: Record<string, boolean>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (completions[key]) streak++;
    else break;
  }
  return streak;
}

export function HabitTrackerRenderer({ content, onChange }: HabitTrackerRendererProps) {
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  const days = getLast7Days();

  // ── Completion toggle ─────────────────────────────────────────────────────

  function toggle(habitId: string, date: string) {
    onChange({
      ...content,
      habits: content.habits.map(h =>
        h.id !== habitId
          ? h
          : { ...h, completions: { ...h.completions, [date]: !h.completions[date] } },
      ),
    });
  }

  // ── Edit mode actions ─────────────────────────────────────────────────────

  function startEdit(habit: Habit) {
    setEditingId(habit.id);
    setEditName(habit.name);
    setEditIcon(habit.icon);
  }

  function commitEdit() {
    const trimmed = editName.trim();
    if (!editingId || !trimmed) return;
    onChange({
      ...content,
      habits: content.habits.map(h =>
        h.id !== editingId ? h : { ...h, name: trimmed, icon: editIcon.trim() || h.icon },
      ),
    });
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function deleteHabit(id: string) {
    onChange({ ...content, habits: content.habits.filter(h => h.id !== id) });
    if (editingId === id) setEditingId(null);
  }

  function addHabit() {
    const id = `h-${Date.now()}`;
    const newHabit: Habit = {
      id,
      name: 'New habit',
      icon: '⭐',
      frequency: 'daily',
      completions: {},
    };
    onChange({ ...content, habits: [...content.habits, newHabit] });
    // Auto-open edit row for the new habit
    setEditingId(id);
    setEditName('New habit');
    setEditIcon('⭐');
  }

  function exitEditMode() {
    setEditingId(null);
    setEditMode(false);
  }

  return (
    <div className="p-4 space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
          Last 7 days
        </p>
        <button
          onClick={editMode ? exitEditMode : () => setEditMode(true)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            editMode
              ? 'bg-orange-500 text-white active:bg-orange-600'
              : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
          aria-label={editMode ? 'Finish editing habits' : 'Edit habits'}
        >
          {editMode ? '✓  Done editing' : 'Edit habits'}
        </button>
      </div>

      {/* Habit cards */}
      {content.habits.map(habit => {
        const streak = getStreak(habit.completions);
        const isThisEditing = editMode && editingId === habit.id;

        return (
          <div
            key={habit.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            {editMode ? (
              /* ── Edit row ────────────────────────────────────────────────── */
              <div className="px-4 py-3">
                {isThisEditing ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editIcon}
                        onChange={e => setEditIcon(e.target.value)}
                        className="w-12 text-center text-lg border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300"
                        maxLength={4}
                        aria-label="Habit icon"
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && commitEdit()}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        aria-label="Habit name"
                        data-testid={`habit-name-input-${habit.id}`}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={commitEdit}
                        className="flex-1 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg active:bg-orange-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 py-2 bg-gray-100 text-gray-600 text-sm font-semibold rounded-lg active:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{habit.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{habit.name}</p>
                      {streak > 0 && (
                        <p className="text-xs text-orange-500 font-semibold">{streak}🔥 streak</p>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(habit)}
                      className="px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 rounded-lg active:bg-orange-100 flex-shrink-0"
                      aria-label={`Edit ${habit.name}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-50 rounded-lg active:bg-red-100 flex-shrink-0"
                      aria-label={`Delete ${habit.name}`}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── View row (mobile card) ──────────────────────────────────── */
              <>
                {/* Habit name header */}
                <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                  <span className="text-lg leading-none flex-shrink-0">{habit.icon}</span>
                  <span className="text-sm font-semibold text-gray-800 truncate">{habit.name}</span>
                  {streak > 0 && (
                    <span className="ml-auto text-xs text-orange-500 font-semibold flex-shrink-0">
                      {streak}🔥
                    </span>
                  )}
                </div>

                {/* Day chips — clearly labelled, one per day */}
                <div className="px-3 pb-3 flex gap-1" role="group" aria-label={`${habit.name} weekly progress`}>
                  {days.map(({ date, dayLabel, dateLabel, isToday }) => {
                    const done = Boolean(habit.completions[date]);
                    return (
                      <button
                        key={date}
                        onClick={() => toggle(habit.id, date)}
                        className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all active:scale-95 ${
                          done
                            ? 'bg-orange-500'
                            : isToday
                            ? 'bg-orange-50 ring-2 ring-orange-300'
                            : 'bg-gray-50 active:bg-gray-100'
                        }`}
                        aria-label={`${habit.name} — ${dayLabel} ${dateLabel}${done ? ', done' : ''}`}
                        aria-pressed={done}
                        data-testid={`day-chip-${habit.id}-${date}`}
                      >
                        <span
                          className={`text-xs font-medium leading-tight ${
                            done ? 'text-white' : isToday ? 'text-orange-600' : 'text-gray-400'
                          }`}
                        >
                          {dayLabel}
                        </span>
                        <span
                          className={`text-xs font-bold leading-tight ${
                            done
                              ? 'text-white'
                              : isToday
                              ? 'text-orange-700 font-extrabold'
                              : 'text-gray-600'
                          }`}
                          data-testid={`day-label-${dayLabel}`}
                        >
                          {dateLabel}
                        </span>
                        {done && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mt-0.5"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {content.habits.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-10 bg-white rounded-2xl border border-gray-100">
          No habits yet.{' '}
          {editMode ? (
            <button
              onClick={addHabit}
              className="text-orange-500 font-semibold underline"
            >
              Add your first habit
            </button>
          ) : (
            <>Tap <span className="font-semibold text-gray-500">"Edit habits"</span> to add some.</>
          )}
        </div>
      )}

      {/* Add habit button — edit mode only */}
      {editMode && content.habits.length > 0 && (
        <button
          onClick={addHabit}
          className="w-full py-3 rounded-2xl bg-orange-50 text-orange-600 text-sm font-semibold border border-orange-100 active:bg-orange-100 flex items-center justify-center gap-2"
          data-testid="add-habit-btn"
        >
          <span className="text-base">+</span>
          Add habit
        </button>
      )}
    </div>
  );
}
