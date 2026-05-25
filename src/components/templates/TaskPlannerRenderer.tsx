import React, { useState } from 'react';
import type { TaskPlannerContent, TaskItem, TaskSection } from '../../types';

interface TaskPlannerRendererProps {
  content: TaskPlannerContent;
  onChange: (updated: TaskPlannerContent) => void;
}

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-600',
  medium: 'bg-amber-100 text-amber-600',
  low: 'bg-gray-100 text-gray-500',
};

const PRIORITIES: TaskItem['priority'][] = ['high', 'medium', 'low'];

export function TaskPlannerRenderer({ content, onChange }: TaskPlannerRendererProps) {
  const [editMode, setEditMode] = useState(false);

  const allTasks = content.sections.flatMap(s => s.tasks);
  const doneCount = allTasks.filter(t => t.done).length;

  function toggleTask(sectionId: string, taskId: string) {
    onChange({
      ...content,
      sections: content.sections.map(s =>
        s.id === sectionId
          ? { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) }
          : s,
      ),
    });
  }

  function updateTask(sectionId: string, taskId: string, patch: Partial<TaskItem>) {
    onChange({
      ...content,
      sections: content.sections.map(s =>
        s.id === sectionId
          ? { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t) }
          : s,
      ),
    });
  }

  function addTask(sectionId: string) {
    const id = `t-${Date.now()}`;
    onChange({
      ...content,
      sections: content.sections.map(s =>
        s.id === sectionId
          ? { ...s, tasks: [...s.tasks, { id, label: 'New task', priority: 'medium', done: false }] }
          : s,
      ),
    });
  }

  function deleteTask(sectionId: string, taskId: string) {
    onChange({
      ...content,
      sections: content.sections.map(s =>
        s.id === sectionId
          ? { ...s, tasks: s.tasks.filter(t => t.id !== taskId) }
          : s,
      ),
    });
  }

  function updateSection(id: string, patch: Partial<TaskSection>) {
    onChange({
      ...content,
      sections: content.sections.map(s => s.id === id ? { ...s, ...patch } : s),
    });
  }

  function addSection() {
    const id = `sec-${Date.now()}`;
    onChange({
      ...content,
      sections: [...content.sections, { id, title: 'New section', tasks: [] }],
    });
  }

  function deleteSection(id: string) {
    onChange({ ...content, sections: content.sections.filter(s => s.id !== id) });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-800">{content.planTitle}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{doneCount}/{allTasks.length} tasks done</p>
        </div>
        <button
          data-testid="edit-tasks-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            editMode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : 'Edit tasks'}
        </button>
      </div>

      {/* Sections */}
      {content.sections.map(section => {
        const sectionDone = section.tasks.filter(t => t.done).length;
        const sectionTotal = section.tasks.length;
        return (
          <div key={section.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              {editMode ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={section.title}
                    onChange={e => updateSection(section.id, { title: e.target.value })}
                    className="flex-1 text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="text-red-400 hover:text-red-600 p-1"
                    aria-label="Delete section"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-gray-800 text-sm">{section.title}</h3>
                  <span className="text-xs text-gray-400">{sectionDone}/{sectionTotal}</span>
                </>
              )}
            </div>

            <div className="divide-y divide-gray-50">
              {section.tasks.map(task => (
                <div key={task.id} className="px-4 py-3">
                  {editMode ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          data-testid={`toggle-task-${task.id}`}
                          onClick={() => toggleTask(section.id, task.id)}
                          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            task.done ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
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
                          onChange={e => updateTask(section.id, task.id, { label: e.target.value })}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <button
                          data-testid={`delete-task-${task.id}`}
                          onClick={() => deleteTask(section.id, task.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                          aria-label="Delete task"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 pl-7">
                        <select
                          data-testid={`task-priority-${task.id}`}
                          value={task.priority}
                          onChange={e => updateTask(section.id, task.id, { priority: e.target.value as TaskItem['priority'] })}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                        >
                          {PRIORITIES.map(p => (
                            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={task.dueDate ?? ''}
                          onChange={e => updateTask(section.id, task.id, { dueDate: e.target.value })}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      data-testid={`toggle-task-${task.id}`}
                      onClick={() => toggleTask(section.id, task.id)}
                      className="w-full flex items-center gap-3 text-left active:bg-gray-50"
                    >
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        task.done ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {editMode && (
              <div className="px-4 pb-4 pt-2">
                <button
                  data-testid="add-task-btn"
                  onClick={() => addTask(section.id)}
                  className="w-full text-sm text-indigo-600 font-semibold border-2 border-dashed border-indigo-200 rounded-xl py-2 active:bg-indigo-50 transition-colors"
                >
                  + Add task
                </button>
              </div>
            )}
          </div>
        );
      })}

      {editMode && (
        <button
          onClick={addSection}
          className="w-full text-sm text-indigo-600 font-semibold border-2 border-dashed border-indigo-200 rounded-2xl py-3 active:bg-indigo-50 transition-colors"
        >
          + Add section
        </button>
      )}
    </div>
  );
}
