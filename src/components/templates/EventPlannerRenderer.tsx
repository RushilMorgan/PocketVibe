import React, { useState } from 'react';
import type { EventPlannerContent, EventTask } from '../../types';

interface EventPlannerRendererProps {
  content: EventPlannerContent;
  onChange: (updated: EventPlannerContent) => void;
}

export function EventPlannerRenderer({ content, onChange }: EventPlannerRendererProps) {
  const [editMode, setEditMode] = useState(false);

  const done = content.tasks.filter(t => t.done).length;
  const total = content.tasks.length;

  function toggleTask(id: string) {
    onChange({
      ...content,
      tasks: content.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t),
    });
  }

  function updateTask(id: string, patch: Partial<EventTask>) {
    onChange({
      ...content,
      tasks: content.tasks.map(t => t.id === id ? { ...t, ...patch } : t),
    });
  }

  function addTask() {
    const id = `t-${Date.now()}`;
    onChange({ ...content, tasks: [...content.tasks, { id, label: 'New task', done: false }] });
  }

  function deleteTask(id: string) {
    onChange({ ...content, tasks: content.tasks.filter(t => t.id !== id) });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header card */}
      <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-5 text-white">
        {editMode ? (
          <div className="space-y-2">
            <input
              value={content.eventName}
              onChange={e => onChange({ ...content, eventName: e.target.value })}
              className="w-full text-lg font-bold bg-white/20 rounded-lg px-3 py-1.5 placeholder-white/60 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder="Event name"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={content.eventDate ?? ''}
                onChange={e => onChange({ ...content, eventDate: e.target.value })}
                className="flex-1 text-sm bg-white/20 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <input
                type="number"
                min={0}
                value={content.guestCount ?? ''}
                onChange={e => onChange({ ...content, guestCount: parseInt(e.target.value) || 0 })}
                placeholder="Guests"
                className="w-24 text-sm bg-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold">{content.eventName}</h2>
            <div className="flex gap-4 mt-2 text-sm opacity-90">
              {content.eventDate && <span>📅 {content.eventDate}</span>}
              {content.guestCount != null && content.guestCount > 0 && (
                <span>👥 {content.guestCount} guests</span>
              )}
            </div>
            <div className="mt-3 text-sm opacity-80">
              {done}/{total} tasks done
            </div>
          </>
        )}
      </div>

      {/* Edit toggle */}
      <div className="flex justify-end">
        <button
          data-testid="edit-event-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            editMode ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : 'Edit event'}
        </button>
      </div>

      {/* Tasks */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Tasks</h3>
          <span className="text-xs text-gray-400">{done}/{total}</span>
        </div>

        {/* Progress bar */}
        <div className="mx-4 mb-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-rose-500 to-pink-500"
            style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : '0%' }}
          />
        </div>

        <div className="divide-y divide-gray-50">
          {content.tasks.map(task => (
            <div key={task.id} className="px-4 py-3">
              {editMode ? (
                <div className="flex items-center gap-2">
                  <button
                    data-testid={`toggle-task-${task.id}`}
                    onClick={() => toggleTask(task.id)}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      task.done ? 'bg-rose-500 border-rose-500' : 'border-gray-300'
                    }`}
                  >
                    {task.done && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <input
                    data-testid={`task-label-${task.id}`}
                    value={task.label}
                    onChange={e => updateTask(task.id, { label: e.target.value })}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                  <input
                    type="date"
                    value={task.dueDate ?? ''}
                    onChange={e => updateTask(task.id, { dueDate: e.target.value })}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                  />
                  <button
                    data-testid={`delete-task-${task.id}`}
                    onClick={() => deleteTask(task.id)}
                    className="text-red-400 hover:text-red-600 p-1"
                    aria-label="Delete task"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  data-testid={`toggle-task-${task.id}`}
                  onClick={() => toggleTask(task.id)}
                  className="w-full flex items-center gap-3 text-left active:bg-gray-50"
                >
                  <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    task.done ? 'bg-rose-500 border-rose-500' : 'border-gray-300'
                  }`}>
                    {task.done && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.label}
                    </span>
                    {task.dueDate && (
                      <div className="text-xs text-gray-400 mt-0.5">Due {task.dueDate}</div>
                    )}
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>

        {editMode && (
          <div className="px-4 pb-4 pt-2">
            <button
              data-testid="add-task-btn"
              onClick={addTask}
              className="w-full text-sm text-rose-500 font-semibold border-2 border-dashed border-rose-200 rounded-xl py-2.5 active:bg-rose-50 transition-colors"
            >
              + Add task
            </button>
          </div>
        )}
      </div>

      {/* Notes */}
      {editMode ? (
        <textarea
          value={content.notes ?? ''}
          onChange={e => onChange({ ...content, notes: e.target.value })}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      ) : content.notes ? (
        <div className="bg-gray-50 rounded-2xl px-4 py-3">
          <p className="text-sm text-gray-500">{content.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
