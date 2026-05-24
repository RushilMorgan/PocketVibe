import React from 'react';
import type { HabitTrackerContent } from '../../types';

interface HabitTrackerRendererProps {
  content: HabitTrackerContent;
  onChange: (updated: HabitTrackerContent) => void;
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const days = getLast7Days();

  function toggle(habitId: string, date: string) {
    const habit = content.habits.find(h => h.id === habitId);
    if (!habit) return;
    const updated: HabitTrackerContent = {
      ...content,
      habits: content.habits.map(h =>
        h.id !== habitId ? h : {
          ...h,
          completions: {
            ...h.completions,
            [date]: !h.completions[date],
          },
        },
      ),
    };
    onChange(updated);
  }

  return (
    <div className="p-4">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Day header row */}
        <div className="grid gap-0" style={{ gridTemplateColumns: `1fr repeat(7, 2.5rem)` }}>
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Habit</div>
          {days.map(date => {
            const d = new Date(date + 'T00:00:00');
            return (
              <div key={date} className="py-3 text-center text-xs text-gray-400 font-medium leading-tight">
                <div>{DAY_LABELS[d.getDay()]}</div>
                <div className="text-gray-300">{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Habit rows */}
        <div className="divide-y divide-gray-50">
          {content.habits.map(habit => {
            const streak = getStreak(habit.completions);
            return (
              <div key={habit.id} className="grid items-center" style={{ gridTemplateColumns: `1fr repeat(7, 2.5rem)` }}>
                {/* Habit label */}
                <div className="px-4 py-3 flex items-center gap-2">
                  <span className="text-base leading-none">{habit.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{habit.name}</div>
                    {streak > 0 && (
                      <div className="text-xs text-orange-500 font-semibold">{streak}🔥</div>
                    )}
                  </div>
                </div>
                {/* Day cells */}
                {days.map(date => {
                  const done = Boolean(habit.completions[date]);
                  const isToday = date === new Date().toISOString().slice(0, 10);
                  return (
                    <button
                      key={date}
                      onClick={() => toggle(habit.id, date)}
                      className={`mx-1 my-2 rounded-lg h-8 flex items-center justify-center transition-all active:scale-95 ${
                        done
                          ? 'bg-violet-600 text-white'
                          : isToday
                          ? 'bg-violet-50 border-2 border-violet-200'
                          : 'bg-gray-100'
                      }`}
                      aria-label={`${habit.name} on ${date}: ${done ? 'done' : 'not done'}`}
                    >
                      {done && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {content.habits.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-10">No habits yet. Ask AI to add some!</div>
        )}
      </div>
    </div>
  );
}
