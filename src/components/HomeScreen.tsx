import React, { useState } from 'react';
import { IDEA_CARDS } from '../lib/templateCatalog';

interface HomeScreenProps {
  onPrompt: (prompt: string) => void;
  isGenerating: boolean;
}

export function HomeScreen({ onPrompt, isGenerating }: HomeScreenProps) {
  const [input, setInput] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    onPrompt(trimmed);
    setInput('');
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">
          What do you want<br />to make today?
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Tap an idea below or describe it yourself
        </p>
      </div>

      {/* Idea cards grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          {IDEA_CARDS.map(card => (
            <button
              key={card.id}
              onClick={() => !isGenerating && onPrompt(card.prompt)}
              disabled={isGenerating}
              className="flex flex-col items-start gap-1.5 p-4 rounded-2xl border border-gray-100 bg-gray-50 active:bg-gray-100 text-left transition-colors disabled:opacity-50"
            >
              <span className="text-2xl leading-none">{card.emoji}</span>
              <span className="text-sm font-semibold text-gray-800 leading-tight">{card.label}</span>
              <span className="text-xs text-gray-500 leading-snug">{card.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Free text input */}
      <div className="flex-shrink-0 px-4 pb-6 pt-3 border-t border-gray-100 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Or describe what you want to make…"
            disabled={isGenerating}
            className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isGenerating || !input.trim()}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-violet-600 text-white disabled:opacity-40 active:bg-violet-700 transition-colors flex-shrink-0"
            aria-label="Make it"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
