import React, { useState } from 'react';
import { TEMPLATE_CATEGORIES } from '../lib/templateCatalog';
import { DEV_MODE } from '../lib/featureFlags';

interface HomeScreenProps {
  onPrompt: (prompt: string) => void;
  isGenerating: boolean;
  onCreateWorldCupPool?: () => void;
  /** Shown as a subtle sign-in link when provided. */
  onSignIn?: () => void;
}

// ── Card data ─────────────────────────────────────────────────────────────────

const WC_POOL = {
  id: 'world-cup-pool',
  prompt: 'Create a friendly World Cup pool for my family. Add participants, draw teams from seeded pots, track results, and show a leaderboard.',
} as const;

const PARTNER_CHALLENGE = {
  id: 'partner-challenge',
  prompt: 'Create a walking and running challenge for me and my partner. We want to do 3 sessions per week, earn points, and see a leaderboard.',
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function HomeScreen({ onPrompt, isGenerating, onCreateWorldCupPool, onSignIn }: HomeScreenProps) {
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

  function handleWCPool() {
    if (isGenerating) return;
    if (onCreateWorldCupPool) onCreateWorldCupPool();
    else handleStarter(WC_POOL.prompt);
  }

  function handlePartnerChallenge() {
    if (isGenerating) return;
    handleStarter(PARTNER_CHALLENGE.prompt);
  }

  // ── Category detail view (DEV_MODE only) ─────────────────────────────────

  if (category) {
    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-6 pb-4 flex-shrink-0 border-b border-gray-100">
          <button
            onClick={() => setSelectedCategory(null)}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 active:bg-gray-200"
            aria-label="Back to home"
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

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            {category.starters.map((starter, i) => (
              <button
                key={i}
                data-testid={`context-suggestion-${starter.label.toLowerCase().replace(/\s+/g, '-')}`}
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

  // ── Main landing view ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {DEV_MODE && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-center">
          <p className="text-xs font-medium text-amber-700">⚙️ Dev mode — all tools visible</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="px-5 pt-7 pb-6">
          <h1 data-testid="landing-headline" className="text-2xl font-black text-gray-900 leading-tight tracking-tight">
            Make little tools for real life.
          </h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-xs">
            Start with a World Cup pool or a partner challenge. Create it, share it, and keep it going together.
          </p>
          {onSignIn && (
            <button
              data-testid="signin-link"
              onClick={onSignIn}
              className="mt-3 text-xs text-violet-600 font-medium hover:underline"
            >
              Already have an account? Sign in
            </button>
          )}
        </div>

        {/* ── Main cards ───────────────────────────────────────────────────── */}
        <div className="px-4 flex flex-col gap-4 pb-6">

          {/* World Cup Pool */}
          <button
            data-testid="flagship-world-cup-pool"
            onClick={handleWCPool}
            disabled={isGenerating}
            className="text-left rounded-3xl overflow-hidden shadow-sm border border-amber-100 active:scale-[0.985] transition-transform disabled:opacity-50 w-full"
          >
            <div className="bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">🏆</span>
                <span className="text-xs font-semibold bg-white/25 text-white px-2.5 py-1 rounded-full">
                  ⚽ 2026
                </span>
              </div>
              <h2 className="text-xl font-black text-white leading-tight">World Cup Pool</h2>
              <p className="text-sm text-white/90 mt-1.5 leading-relaxed">
                Create a friendly pool with a fair team draw, share it with family or friends, and follow the leaderboard as results come in.
              </p>
            </div>
            <div className="bg-white px-5 py-3 space-y-1.5">
              {[
                '🎯 Fair seeded draw — every team assigned',
                '📊 Live leaderboard',
                '🔗 Share with family or work friends',
                '⚽ Results tracking as games happen',
              ].map(h => (
                <p key={h} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="flex-shrink-0">{h.slice(0, 2)}</span>
                  <span>{h.slice(3)}</span>
                </p>
              ))}
              <div className="pt-2">
                <span
                  data-testid="make-world-cup-pool-btn"
                  className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl w-full justify-center"
                >
                  Make a World Cup Pool
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </div>
            </div>
          </button>

          {/* Partner Challenge */}
          <button
            data-testid="flagship-partner-challenge"
            onClick={handlePartnerChallenge}
            disabled={isGenerating}
            className="text-left rounded-3xl overflow-hidden shadow-sm border border-violet-100 active:scale-[0.985] transition-transform disabled:opacity-50 w-full"
          >
            <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">🏃</span>
                <span className="text-xs font-semibold bg-white/25 text-white px-2.5 py-1 rounded-full">
                  Fitness
                </span>
              </div>
              <h2 className="text-xl font-black text-white leading-tight">Partner Challenge</h2>
              <p className="text-sm text-white/90 mt-1.5 leading-relaxed">
                Create a fun challenge for you and your partner. Log walks or runs, earn points, and track progress week after week.
              </p>
            </div>
            <div className="bg-white px-5 py-3 space-y-1.5">
              {[
                '🎯 Weekly goals and streaks',
                '🏅 Points for every session',
                '📈 Progress tracked over time',
                '🔗 Shared link for your partner',
              ].map(h => (
                <p key={h} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="flex-shrink-0">{h.slice(0, 2)}</span>
                  <span>{h.slice(3)}</span>
                </p>
              ))}
              <div className="pt-2">
                <span
                  data-testid="make-partner-challenge-btn"
                  className="inline-flex items-center gap-1.5 bg-violet-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl w-full justify-center"
                >
                  Make a Partner Challenge
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <div data-testid="how-it-works" className="px-5 pb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">How it works</p>
          <div className="flex flex-col gap-4">
            {[
              { step: '1', label: 'Pick what you want to make', icon: '👆' },
              { step: '2', label: 'Toolie creates it for you', icon: '✨' },
              { step: '3', label: 'Edit, share and use it', icon: '🔗' },
            ].map(({ step, label, icon }) => (
              <div key={step} className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
                  {icon}
                </div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Trust note ───────────────────────────────────────────────────── */}
        <div className="mx-4 mb-6 px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed">
            🔒 You own what you create. People you share with can view or take part — they can't edit your original tool.
          </p>
        </div>

        {/* ── DEV_MODE: all tools + chat input ─────────────────────────────── */}
        {DEV_MODE && (
          <div data-testid="dev-mode-section" className="px-4 pb-8 border-t border-dashed border-amber-200 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              All tools (dev only)
            </p>
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
            <div className="mt-4 pt-4 border-t border-gray-100">
              <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask Toolie what you want to make…"
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
        )}
      </div>
    </div>
  );
}
