import React, { useState } from 'react';
import { TEMPLATE_CATEGORIES } from '../lib/templateCatalog';

interface HomeScreenProps {
  onPrompt: (prompt: string) => void;
  isGenerating: boolean;
}

export function HomeScreen({ onPrompt, isGenerating }: HomeScreenProps) {
  const [input, setInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const category = TEMPLATE_CATEGORIES.find(c => c.id === selectedCategory) ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    onPrompt(trimmed);
    setInput('');
  }

  function handleStarter(prompt: string) {
    if (isGenerating) return;
    onPrompt(prompt);
  }

  // ── Category detail view ─────────────────────────────────────────────────
  if (category) {
    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        {/* Back header */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-4 flex-shrink-0 border-b border-gray-100">
          <button
            onClick={() => setSelectedCategory(null)}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 active:bg-gray-200"
            aria-label="Back to categories"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              {category.emoji} {category.name}
            </h2>
            <p className="text-xs text-gray-500">{category.tagline}</p>
          </div>
        </div>

        {/* Starter cards */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            {category.starters.map((starter, i) => (
              <button
                key={i}
                onClick={() => handleStarter(starter.prompt)}
                disabled={isGenerating}
                className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50 active:bg-gray-100 text-left transition-colors disabled:opacity-50"
              >
                <span className="text-2xl leading-none flex-shrink-0">{category.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{starter.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{starter.prompt}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom input */}
        <div className="flex-shrink-0 px-4 pb-6 pt-3 border-t border-gray-100 bg-white">
          <p className="text-xs text-gray-400 mb-2">Or describe exactly what you want…</p>
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Something in ${category.name.toLowerCase()}…`}
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

  // ── Category grid view ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">
          What do you want<br />to make today?
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Pick a category to get started
        </p>
      </div>

      {/* Category grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              disabled={isGenerating}
              className="flex flex-col items-start gap-1.5 p-4 rounded-2xl border border-gray-100 bg-gray-50 active:bg-gray-100 text-left transition-colors disabled:opacity-50"
            >
              <span className="text-2xl leading-none">{cat.emoji}</span>
              <span className="text-sm font-semibold text-gray-800 leading-tight">{cat.name}</span>
              <span className="text-xs text-gray-500 leading-snug">{cat.tagline}</span>
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
