import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Creation, TournamentPoolTrackerContent, WorkoutTrackerContent } from '../types';
import { getAIConnectionStatus } from '../services/aiService';

interface CreationComposerProps {
  activeCreation: Creation | null;
  messages: ChatMessage[];
  isGenerating: boolean;
  processingStatus: string | null;
  onNew: (request: string) => void;
  onImprove: (request: string) => void;
  onAdd: (request: string) => void;
  /** Fast chat path: Q&A or modification routing for an active creation. */
  onChat?: (request: string) => void;
  onToolAction?: (actionId: string) => void;
}

interface ContextSuggestion {
  id: string;
  label: string;
  prompt: string;
  localActionId?: string;
}

function buildPoolSuggestions(creation: Creation): ContextSuggestion[] {
  const content = creation.content as TournamentPoolTrackerContent;
  const unassignedTeams = content.teams.filter(team => !team.assignedTo).length;
  const hasParticipants = content.participants.length > 0;
  const hasMatches = content.matches.length > 0;
  const shared = Boolean(creation.shareSlug);

  if (!hasParticipants) {
    return [
      { id: 'add-people', label: 'Add people', prompt: 'Add people to this pool and make the setup feel smooth on mobile.' },
      { id: 'show-teams', label: 'Show me my teams', prompt: 'Show me my teams and explain how the draw will work.' },
    ];
  }

  if (!content.drawLocked || unassignedTeams > 0) {
    return [
      { id: 'run-draw', label: 'Run the draw', prompt: 'Run the draw and reveal the teams in a fun step-by-step way.', localActionId: 'run-draw-all' },
      { id: 'show-teams', label: 'Show me my teams', prompt: 'Show me my teams and the pots they came from.' },
      { id: 'share', label: shared ? 'Copy share link' : 'Share this pool', prompt: shared ? 'Copy share link for this pool.' : 'Share this pool with everyone.', localActionId: 'share' },
    ];
  }

  return [
    { id: 'show-teams', label: 'Show me my teams', prompt: 'Show me my teams and explain why I am in this position.' },
    { id: 'add-result', label: hasMatches ? 'Add another result' : 'Add a result', prompt: 'Add a result to this pool.', localActionId: 'add-result' },
    { id: 'scoring', label: 'Change scoring', prompt: 'Change scoring for this pool.', localActionId: 'edit-scoring' },
    { id: 'leaderboard', label: 'Explain the leaderboard', prompt: 'Explain the leaderboard for this pool.' },
    { id: 'share', label: shared ? 'Copy share link' : 'Share this pool', prompt: shared ? 'Copy share link for this pool.' : 'Share this pool with everyone.', localActionId: 'share' },
    { id: 'colours', label: 'Change colours', prompt: 'Change colours for this pool.', localActionId: 'change-theme' },
  ];
}

function buildChallengeSuggestions(creation: Creation): ContextSuggestion[] {
  const content = creation.content as WorkoutTrackerContent;
  const participants = content.participants ?? [];
  const logs = content.logs ?? [];
  const shared = Boolean(creation.shareSlug);

  if (participants.length < 2) {
    return [
      { id: 'add-partner', label: 'Add my partner', prompt: 'Add my partner to this challenge.' },
      { id: 'target', label: 'Change weekly target', prompt: 'Change weekly target for this challenge.' },
    ];
  }

  if (logs.length === 0) {
    return [
      { id: 'first-log', label: 'Log first activity', prompt: 'Log a walk for me.' },
      { id: 'share', label: shared ? 'Copy share link' : 'Share with my partner', prompt: shared ? 'Copy share link for this challenge.' : 'Share with my partner.' },
      { id: 'progress', label: 'Show this week’s progress', prompt: 'Show this week’s progress for this challenge.' },
    ];
  }

  return [
    { id: 'log-walk', label: 'Log a walk for me', prompt: 'Log a walk for me.' },
    { id: 'target', label: 'Change weekly target', prompt: 'Change weekly target for this challenge.' },
    { id: 'scoring', label: 'Make runs worth more points', prompt: 'Make runs worth more points.' },
    { id: 'share', label: shared ? 'Copy share link' : 'Share with my partner', prompt: shared ? 'Copy share link for this challenge.' : 'Share with my partner.' },
    { id: 'progress', label: 'Show this week’s progress', prompt: 'Show this week’s progress for this challenge.' },
  ];
}

function getContext(activeCreation: Creation | null): {
  title: string;
  placeholder: string;
  suggestions: ContextSuggestion[];
} {
  if (!activeCreation) {
    return {
      title: 'Ask Toolie to make something',
      placeholder: 'Describe what you want to make…',
      suggestions: [],
    };
  }

  if (activeCreation.content.type === 'tournament_pool_tracker') {
    return {
      title: 'Ask Toolie about this pool',
      placeholder: 'Ask about the pool, draw, scoring, or sharing…',
      suggestions: buildPoolSuggestions(activeCreation),
    };
  }

  if (activeCreation.content.type === 'workout_tracker') {
    return {
      title: 'Ask Toolie about this challenge',
      placeholder: 'Ask about logging, scoring, sharing, or progress…',
      suggestions: buildChallengeSuggestions(activeCreation),
    };
  }

  return {
    title: 'Ask Toolie about this tool',
    placeholder: 'What should change?',
    suggestions: [],
  };
}

export function CreationComposer({
  activeCreation,
  messages,
  isGenerating,
  processingStatus,
  onNew,
  onImprove,
  onAdd: _onAdd,
  onChat,
  onToolAction,
}: CreationComposerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasActive = Boolean(activeCreation);
  const aiStatus = getAIConnectionStatus();
  const context = getContext(activeCreation);
  if (isOpen && !aiStatus.connected) {
    console.log('[PocketVibe] AI not connected:', aiStatus.reason);
  }

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  function sendPrompt(prompt: string) {
    if (!prompt.trim() || isGenerating) return;
    if (hasActive) {
      // Use the smart chat path when available: the AI decides whether this is
      // a Q&A question (gets a direct answer) or a modification (full pipeline).
      if (onChat) onChat(prompt.trim());
      else onImprove(prompt.trim());
    } else {
      onNew(prompt.trim());
    }
    setInput('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendPrompt(input);
  }

  return (
    <>
      {/* FAB trigger */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute bottom-6 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-xl z-20"
          style={{ background: hasActive ? 'linear-gradient(135deg, #111827, #374151)' : 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          aria-label={hasActive ? context.title : 'Make something'}
        >
          ✨
        </button>
      )}

      {/* Sheet overlay */}
      {isOpen && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[82%] z-10">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-4 pb-2 flex-shrink-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Toolie</p>
              <h3 className="text-base font-bold text-gray-900">{context.title}</h3>
            </div>

            {isGenerating && processingStatus && (
              <div className="mx-4 mb-2 px-4 py-2 bg-violet-50 rounded-xl flex items-center gap-2 flex-shrink-0">
                <span className="text-base animate-spin">⚙️</span>
                <span className="text-sm text-violet-700 font-medium">{processingStatus}</span>
              </div>
            )}

            {/* AI status banner */}
            {!aiStatus.connected && (
              <div
                data-testid="ai-status-banner"
                className="mx-4 mb-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 flex-shrink-0"
              >
                <span className="text-base">⚠️</span>
                <span className="text-sm text-amber-700">
                  AI updates are not connected yet. You can still edit this tool directly.
                </span>
              </div>
            )}

            {context.suggestions.length > 0 && !isGenerating && (
              <div data-testid="contextual-chat-suggestions" className="flex gap-2 overflow-x-auto px-4 pb-2 flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
                {context.suggestions.map(suggestion => (
                  <button
                    key={suggestion.id}
                    data-testid={`context-suggestion-${suggestion.id}`}
                    onClick={() => {
                      if (suggestion.localActionId) {
                        onToolAction?.(suggestion.localActionId);
                        setIsOpen(false);
                      } else {
                        sendPrompt(suggestion.prompt);
                      }
                    }}
                    className="flex-shrink-0 whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 active:bg-gray-100"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}

            {messages.length > 0 && (
              <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-gray-900 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2 items-center px-4 pb-6 pt-2 flex-shrink-0">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  isGenerating
                    ? 'Working on it…'
                    : context.placeholder
                }
                disabled={isGenerating}
                autoFocus
                className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isGenerating || !input.trim()}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-gray-900 text-white disabled:opacity-40 active:bg-black transition-colors flex-shrink-0"
                aria-label="Send"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
