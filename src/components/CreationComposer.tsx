import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Creation } from '../types';
import { getAIConnectionStatus } from '../services/aiService';

interface CreationComposerProps {
  activeCreation: Creation | null;
  messages: ChatMessage[];
  isGenerating: boolean;
  processingStatus: string | null;
  onNew: (request: string) => void;
  onImprove: (request: string) => void;
  onAdd: (request: string) => void;
}

export function CreationComposer({
  activeCreation,
  messages,
  isGenerating,
  processingStatus,
  onNew,
  onImprove,
  onAdd,
}: CreationComposerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasActive = Boolean(activeCreation);
  const aiStatus = getAIConnectionStatus();
  if (isOpen && !aiStatus.connected) {
    console.log('[PocketVibe] AI not connected:', aiStatus.reason);
  }

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    if (hasActive) {
      onImprove(trimmed);
    } else {
      onNew(trimmed);
    }
    setInput('');
  }

  function handleQuickAction(mode: 'improve' | 'add' | 'new') {
    const trimmed = input.trim();
    if (mode === 'new') {
      onNew(trimmed || 'Make me something new');
      setInput('');
    } else if (trimmed) {
      if (mode === 'improve') onImprove(trimmed);
      else onAdd(trimmed);
      setInput('');
    }
  }

  return (
    <>
      {/* FAB trigger */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute bottom-6 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-xl z-20"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          aria-label={hasActive ? 'Chat with AI about this creation' : 'Make something'}
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
          <div className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[80%] z-10">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Status bar */}
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

            {/* Messages */}
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
                          ? 'bg-violet-600 text-white rounded-br-sm'
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

            {/* Quick action chips (only when active creation) */}
            {hasActive && !isGenerating && (
              <div className="flex gap-2 px-4 pb-2 overflow-x-auto flex-shrink-0">
                <button
                  onClick={() => handleQuickAction('improve')}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 text-xs text-violet-700 font-medium whitespace-nowrap"
                >
                  ✨ Improve this
                </button>
                <button
                  onClick={() => handleQuickAction('add')}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-xs text-blue-700 font-medium whitespace-nowrap"
                >
                  ➕ Add to this
                </button>
                <button
                  onClick={() => handleQuickAction('new')}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-xs text-gray-600 font-medium whitespace-nowrap"
                >
                  🆕 Start fresh
                </button>
              </div>
            )}

            {/* Input area */}
            <form onSubmit={handleSubmit} className="flex gap-2 items-center px-4 pb-6 pt-2 flex-shrink-0">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  isGenerating
                    ? 'Working on it…'
                    : hasActive
                    ? 'Make it better, add something, start fresh…'
                    : 'Describe what you want to make…'
                }
                disabled={isGenerating}
                autoFocus
                className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isGenerating || !input.trim()}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-violet-600 text-white disabled:opacity-40 active:bg-violet-700 transition-colors flex-shrink-0"
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
