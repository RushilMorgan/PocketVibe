import React, { useState } from 'react';
import { TEMPLATE_CATEGORIES } from '../lib/templateCatalog';
import { DEV_MODE } from '../lib/featureFlags';

interface HomeScreenProps {
  onPrompt: (prompt: string) => void;
  isGenerating: boolean;
  onCreateWorldCupPool?: () => void;
  /** Shown as a subtle sign-in link when provided. */
  onSignIn?: () => void;
  /** Opens the Toolie chat sheet from the home screen. */
  onOpenChat?: () => void;
  /** Opens the guided Idea Board intake. */
  onOpenIdeaBoard?: () => void;
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

export function HomeScreen({ onPrompt, isGenerating, onCreateWorldCupPool, onSignIn, onOpenChat, onOpenIdeaBoard }: HomeScreenProps) {
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
        <div className="relative overflow-hidden px-5 pt-8 pb-7 bg-gradient-to-b from-violet-950/6 to-transparent">
          {/* Subtle geometric accent */}
          <div className="absolute top-4 right-4 w-24 h-24 rounded-full bg-violet-500/5 pointer-events-none" />
          <div className="absolute top-8 right-8 w-12 h-12 rounded-full bg-violet-500/5 pointer-events-none" />

          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-violet-500 text-xs">✦</span>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-400">AI-powered tools</p>
          </div>
          <h1 data-testid="landing-headline" className="text-3xl font-black text-gray-900 leading-tight tracking-tight">
            Make little tools for real life.
          </h1>
          <p className="text-sm text-gray-500 mt-2.5 leading-relaxed max-w-xs">
            Just tell Toolie what you need. It builds the tool, you use it — share it and keep going together.
          </p>
          {onSignIn && (
            <button
              data-testid="signin-link"
              onClick={onSignIn}
              className="mt-3 text-xs text-violet-600 font-semibold bg-violet-50 px-3 py-1.5 rounded-full border border-violet-100 active:bg-violet-100"
            >
              Already have an account? Sign in →
            </button>
          )}
        </div>

        {/* ── Main cards ───────────────────────────────────────────────────── */}
        <div className="px-4 flex flex-col gap-4 pb-6">

          {/* World Cup Pool — FIFA dark navy + gold */}
          <button
            data-testid="flagship-world-cup-pool"
            onClick={handleWCPool}
            disabled={isGenerating}
            className="text-left rounded-3xl overflow-hidden shadow-2xl active:scale-[0.985] transition-all disabled:opacity-50 w-full ring-1 ring-yellow-400/40"
          >
            {/* ── Dark FIFA navy panel ─────────────────────────────────────── */}
            <div className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 pt-5 pb-6 overflow-hidden">

              {/* Stadium arc decorations */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-96 h-48 rounded-t-full border-2 border-white/10 pointer-events-none" />
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-60 h-30 rounded-t-full border border-white/10 pointer-events-none" />
              {/* Ghost ball watermark */}
              <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full border-4 border-white/5 pointer-events-none" />
              <div className="absolute -right-2 top-6 w-16 h-16 rounded-full border-2 border-white/5 pointer-events-none" />

              {/* Top row: host nations + FIFA badge */}
              <div className="relative z-10 flex items-center justify-between mb-5">
                <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                  <span className="text-base leading-none">🇺🇸</span>
                  <span className="text-base leading-none">🇨🇦</span>
                  <span className="text-base leading-none">🇲🇽</span>
                  <span className="text-xs text-white/60 font-semibold ml-1 tracking-wide">2026 Hosts</span>
                </div>
                <span className="text-xs font-black bg-yellow-400 text-slate-900 px-3 py-1 rounded-full tracking-widest uppercase">
                  FIFA 2026
                </span>
              </div>

              {/* Trophy + title */}
              <div className="relative z-10 flex items-center gap-4 mb-3">
                <span className="text-6xl leading-none">🏆</span>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="h-px w-8 bg-yellow-400" />
                    <div className="h-px w-3 bg-yellow-400/40" />
                  </div>
                  <h2 className="text-2xl font-black text-white leading-tight tracking-wide uppercase">World Cup</h2>
                  <h2 className="text-2xl font-black text-yellow-400 leading-tight tracking-wide uppercase">Pool</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-px w-8 bg-yellow-400" />
                    <div className="h-px w-3 bg-yellow-400/40" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="relative z-10 text-sm text-white/70 leading-relaxed mb-4">
                Fair seeded draw, results tracking, and a live leaderboard. Share with family or workmates and follow every match together.
              </p>

              {/* Feature chips */}
              <div className="relative z-10 flex flex-wrap gap-2">
                {[
                  { icon: '🎲', label: 'Seeded fair draw' },
                  { icon: '📊', label: 'Live leaderboard' },
                  { icon: '🔗', label: 'Share instantly' },
                  { icon: '⚽', label: 'Results tracking' },
                ].map(chip => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-300 bg-yellow-400/10 border border-yellow-400/25 px-2.5 py-1 rounded-full"
                  >
                    {chip.icon} {chip.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Gold CTA strip ───────────────────────────────────────────── */}
            <div
              data-testid="make-world-cup-pool-btn"
              className="bg-yellow-400 px-5 py-3.5 flex items-center justify-between"
            >
              <span className="text-sm font-black text-slate-900 tracking-tight">Make a World Cup Pool</span>
              <div className="w-7 h-7 rounded-full bg-slate-900/15 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          </button>

          {/* Partner Challenge — dark charcoal + emerald */}
          <button
            data-testid="flagship-partner-challenge"
            onClick={handlePartnerChallenge}
            disabled={isGenerating}
            className="text-left rounded-3xl overflow-hidden shadow-2xl active:scale-[0.985] transition-all disabled:opacity-50 w-full ring-1 ring-emerald-400/40"
          >
            {/* ── Dark charcoal panel ───────────────────────────────────────── */}
            <div className="relative bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 px-5 pt-5 pb-6 overflow-hidden">

              {/* Running track oval arcs */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-80 h-20 rounded-full border-2 border-white/8 pointer-events-none" />
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-56 h-14 rounded-full border border-white/6 pointer-events-none" />
              {/* 🏃 watermark */}
              <div className="absolute -right-3 top-2 text-7xl opacity-5 pointer-events-none select-none">🏃</div>
              <div className="absolute right-10 -bottom-2 text-4xl opacity-5 pointer-events-none select-none rotate-12">🏃</div>

              {/* Top row: activity types + badge */}
              <div className="relative z-10 flex items-center justify-between mb-5">
                <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                  <span className="text-base leading-none">🚶</span>
                  <span className="text-base leading-none">🏃</span>
                  <span className="text-base leading-none">💪</span>
                  <span className="text-base leading-none">⭐</span>
                  <span className="text-xs text-white/60 font-semibold ml-1 tracking-wide">Activities</span>
                </div>
                <span className="text-xs font-black bg-emerald-400 text-gray-900 px-3 py-1 rounded-full tracking-widest uppercase">
                  Fitness ⚡
                </span>
              </div>

              {/* 🏃 + title */}
              <div className="relative z-10 flex items-center gap-4 mb-3">
                <span className="text-6xl leading-none">🏃</span>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="h-px w-8 bg-emerald-400" />
                    <div className="h-px w-3 bg-emerald-400/40" />
                  </div>
                  <h2 className="text-2xl font-black text-white leading-tight tracking-wide uppercase">Partner</h2>
                  <h2 className="text-2xl font-black text-emerald-400 leading-tight tracking-wide uppercase">Challenge</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-px w-8 bg-emerald-400" />
                    <div className="h-px w-3 bg-emerald-400/40" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="relative z-10 text-sm text-white/70 leading-relaxed mb-4">
                Set a weekly fitness goal with your partner. Log every walk, run or gym session, earn points, and stay neck and neck all season.
              </p>

              {/* Feature chips */}
              <div className="relative z-10 flex flex-wrap gap-2">
                {[
                  { icon: '🎯', label: 'Weekly targets' },
                  { icon: '🏅', label: 'Points & streaks' },
                  { icon: '📈', label: 'Live leaderboard' },
                  { icon: '🔗', label: 'Share with partner' },
                ].map(chip => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/25 px-2.5 py-1 rounded-full"
                  >
                    {chip.icon} {chip.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Emerald CTA strip ─────────────────────────────────────────── */}
            <div
              data-testid="make-partner-challenge-btn"
              className="bg-emerald-400 px-5 py-3.5 flex items-center justify-between"
            >
              <span className="text-sm font-black text-gray-900 tracking-tight">Start a Partner Challenge</span>
              <div className="w-7 h-7 rounded-full bg-gray-900/15 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* ── Idea Thinking Board card ──────────────────────────────────── */}
        <div className="px-4 pb-4">
          <button
            data-testid="flagship-idea-board"
            onClick={onOpenIdeaBoard}
            disabled={isGenerating || !onOpenIdeaBoard}
            className="text-left rounded-3xl overflow-hidden shadow-lg active:scale-[0.985] transition-all disabled:opacity-50 w-full ring-1 ring-violet-400/30"
          >
            {/* Dark violet panel */}
            <div className="relative bg-gradient-to-br from-violet-950 via-indigo-950 to-violet-950 px-5 pt-5 pb-5 overflow-hidden">
              {/* Geometric accents */}
              <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full border-2 border-violet-400/10 pointer-events-none" />
              <div className="absolute right-8 bottom-2 w-16 h-16 rounded-full border border-violet-400/8 pointer-events-none" />
              <div className="absolute -left-4 bottom-0 w-20 h-20 rounded-full border border-violet-400/6 pointer-events-none" />

              {/* Top row: labels */}
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                  <span className="text-base leading-none">🧠</span>
                  <span className="text-base leading-none">📊</span>
                  <span className="text-base leading-none">💰</span>
                  <span className="text-xs text-white/60 font-semibold ml-1 tracking-wide">Ideas</span>
                </div>
                <span className="text-xs font-black bg-violet-400 text-violet-950 px-3 py-1 rounded-full tracking-widest uppercase">
                  New ✦
                </span>
              </div>

              {/* Icon + title */}
              <div className="relative z-10 flex items-center gap-4 mb-3">
                <span className="text-5xl leading-none">💡</span>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="h-px w-8 bg-violet-400" />
                    <div className="h-px w-3 bg-violet-400/40" />
                  </div>
                  <h2 className="text-xl font-black text-white leading-tight tracking-wide uppercase">Idea</h2>
                  <h2 className="text-xl font-black text-violet-300 leading-tight tracking-wide uppercase">Thinking Board</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-px w-8 bg-violet-400" />
                    <div className="h-px w-3 bg-violet-400/40" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="relative z-10 text-sm text-white/65 leading-relaxed mb-4">
                Turn a rough idea into a visual plan. Explore who it's for, risks, how it could make money, and what to build first.
              </p>

              {/* Feature chips */}
              <div className="relative z-10 flex flex-wrap gap-2">
                {[
                  { icon: '❤️', label: 'Idea health score' },
                  { icon: '🗺️', label: 'Visual map' },
                  { icon: '⚠️', label: 'Risk analysis' },
                  { icon: '💰', label: 'Money ideas' },
                ].map(chip => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-200 bg-violet-400/10 border border-violet-400/25 px-2.5 py-1 rounded-full"
                  >
                    {chip.icon} {chip.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Violet CTA strip */}
            <div className="bg-violet-500 px-5 py-3.5 flex items-center justify-between">
              <span className="text-sm font-black text-white tracking-tight">Think through an idea</span>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* ── Toolie nudge ─────────────────────────────────────────────────── */}
        <div className="px-4 pb-5">
          <button
            onClick={onOpenChat}
            disabled={!onOpenChat}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-950 border border-white/5 active:bg-gray-900 transition-colors text-left"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 2px 12px rgba(124,58,237,0.4)' }}
            >
              ✨
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white leading-tight">Want something else?</p>
              <p className="text-xs text-white/45 mt-0.5">Just tell Toolie — it can build almost anything.</p>
            </div>
            <span className="text-white/30 text-sm flex-shrink-0">→</span>
          </button>
        </div>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <div data-testid="how-it-works" className="px-5 pb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gray-100" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">How it works</p>
            <div className="h-px flex-1 bg-gray-100" />
          </div>
          <div className="flex flex-col gap-3.5">
            {[
              { step: '1', label: 'Describe what you want to Toolie', icon: '💬', sub: 'In plain English — no tech knowledge needed' },
              { step: '2', label: 'Toolie builds it instantly', icon: '✨', sub: 'A real working tool, not just a template' },
              { step: '3', label: 'Share it and keep it going', icon: '🔗', sub: 'Everyone stays in sync in real time' },
            ].map(({ step, label, icon, sub }) => (
              <div key={step} className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-base flex-shrink-0 shadow-sm shadow-violet-200">
                  {icon}
                </div>
                <div className="pt-0.5">
                  <p className="text-sm font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Trust note ───────────────────────────────────────────────────── */}
        <div className="mx-4 mb-6 px-4 py-3.5 bg-gray-900 rounded-2xl">
          <p className="text-xs text-white/60 leading-relaxed">
            <span className="text-white/80 font-semibold">🔒 You own what you create.</span>
            {' '}People you share with can view or take part — they can't edit your original tool.
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
