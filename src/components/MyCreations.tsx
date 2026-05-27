import React, { useState } from 'react';
import type { Creation, CreationType } from '../types';

interface MyCreationsProps {
  creations: Creation[];
  activeCreationId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onBack: () => void;
}

const TYPE_EMOJI: Record<CreationType, string> = {
  checklist: '✅',
  habit_tracker: '🔁',
  budget_calculator: '💰',
  savings_tracker: '💸',
  landing_page: '🌐',
  event_planner: '🎉',
  meal_planner: '🍽️',
  workout_tracker: '💪',
  price_calculator: '🧾',
  task_planner: '📌',
};

const TYPE_LABEL: Record<CreationType, string> = {
  checklist: 'Checklist',
  habit_tracker: 'Habit tracker',
  budget_calculator: 'Budget',
  savings_tracker: 'Savings goal',
  landing_page: 'Landing page',
  event_planner: 'Event planner',
  meal_planner: 'Meal planner',
  workout_tracker: 'Workout plan',
  price_calculator: 'Price calculator',
  task_planner: 'Task planner',
};

function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function MyCreations({
  creations,
  activeCreationId,
  onOpen,
  onDelete,
  onDuplicate,
  onRename,
  onBack,
}: MyCreationsProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  function startRename(creation: Creation) {
    setRenamingId(creation.id);
    setRenameValue(creation.title);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) onRename(id, trimmed);
    setRenamingId(null);
    setRenameValue('');
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue('');
  }

  const sorted = [...creations].sort((a, b) => b.updatedAt - a.updatedAt);

  function handleDelete(id: string) {
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4 flex-shrink-0 border-b border-gray-100">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 active:bg-gray-200"
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">My things</h2>
          <p className="text-xs text-gray-500">{sorted.length} creation{sorted.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-3">
            <span className="text-4xl">📭</span>
            <p className="text-gray-500 text-sm">Nothing here yet. Go to the home screen and make something!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sorted.map(creation => {
              const isActive = creation.id === activeCreationId;
              const isConfirming = confirmDeleteId === creation.id;
              return (
                <div
                  key={creation.id}
                  className={`px-4 py-4 ${isActive ? 'bg-violet-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Tap area */}
                    <button
                      onClick={() => onOpen(creation.id)}
                      className="flex items-start gap-3 flex-1 text-left min-w-0"
                    >
                      <span className="text-2xl leading-none flex-shrink-0 mt-0.5">
                        {TYPE_EMOJI[creation.creationType] ?? '📄'}
                      </span>
                      <div className="min-w-0 flex-1">
                        {renamingId === creation.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(creation.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitRename(creation.id);
                              if (e.key === 'Escape') cancelRename();
                            }}
                            onClick={e => e.stopPropagation()}
                            maxLength={100}
                            className="w-full text-sm font-semibold border border-violet-400 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm truncate max-w-[140px]">
                              {creation.title}
                            </span>
                            {creation.version > 1 && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full flex-shrink-0">
                                v{creation.version}
                              </span>
                            )}
                            {isActive && (
                              <span className="text-xs px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded-full font-medium flex-shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {TYPE_LABEL[creation.creationType]} · {timeAgo(creation.updatedAt)}
                        </p>
                        {creation.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{creation.description}</p>
                        )}
                      </div>
                    </button>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                      <button
                        onClick={e => { e.stopPropagation(); startRename(creation); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100"
                        aria-label="Rename"
                        title="Rename"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDuplicate(creation.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100"
                        aria-label="Duplicate"
                        title="Duplicate"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(creation.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center active:bg-red-50 ${isConfirming ? 'text-red-500' : 'text-gray-300'}`}
                        aria-label={isConfirming ? 'Tap again to confirm delete' : 'Delete'}
                        title={isConfirming ? 'Tap again to confirm' : 'Delete'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isConfirming && (
                    <p className="text-xs text-red-500 mt-1.5 ml-10">Tap delete again to confirm</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
