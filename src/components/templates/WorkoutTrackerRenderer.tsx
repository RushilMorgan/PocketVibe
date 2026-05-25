import React, { useState } from 'react';
import type { WorkoutTrackerContent, WorkoutExercise } from '../../types';

interface WorkoutTrackerRendererProps {
  content: WorkoutTrackerContent;
  onChange: (updated: WorkoutTrackerContent) => void;
}

export function WorkoutTrackerRenderer({ content, onChange }: WorkoutTrackerRendererProps) {
  const [editMode, setEditMode] = useState(false);

  const completedDays = content.days.filter(d => d.completed).length;

  function toggleDay(id: string) {
    onChange({
      ...content,
      days: content.days.map(d => d.id === id ? { ...d, completed: !d.completed } : d),
    });
  }

  function updateDay(id: string, label: string) {
    onChange({
      ...content,
      days: content.days.map(d => d.id === id ? { ...d, label } : d),
    });
  }

  function updateExercise(dayId: string, exId: string, patch: Partial<WorkoutExercise>) {
    onChange({
      ...content,
      days: content.days.map(d =>
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
      days: content.days.map(d =>
        d.id === dayId
          ? { ...d, exercises: [...d.exercises, { id, name: 'New exercise', sets: 3, reps: '10' }] }
          : d,
      ),
    });
  }

  function deleteExercise(dayId: string, exId: string) {
    onChange({
      ...content,
      days: content.days.map(d =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter(e => e.id !== exId) }
          : d,
      ),
    });
  }

  function addDay() {
    const id = `d-${Date.now()}`;
    const num = content.days.length + 1;
    onChange({
      ...content,
      days: [...content.days, { id, label: `Day ${num}`, exercises: [], completed: false }],
    });
  }

  function deleteDay(id: string) {
    onChange({ ...content, days: content.days.filter(d => d.id !== id) });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl p-5 text-white">
        <h2 className="text-xl font-bold">{content.planName}</h2>
        <p className="text-sm opacity-90 mt-1">{completedDays}/{content.days.length} days completed</p>
        <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: content.days.length > 0 ? `${Math.round((completedDays / content.days.length) * 100)}%` : '0%' }}
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
      {content.days.map(day => (
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
