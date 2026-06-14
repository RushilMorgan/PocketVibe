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
  /** Opens the guided Recipe intake. */
  onOpenRecipe?: () => void;
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

export function HomeScreen({ onPrompt, isGenerating, onCreateWorldCupPool, onSignIn, onOpenChat, onOpenIdeaBoard, onOpenRecipe }: HomeScreenProps) {
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

  // ── Main landing view (Velix light/frosted) ───────────────────────────────

  return (
    <div className="tp-surface flex flex-col h-full overflow-hidden">
      {DEV_MODE && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-center">
          <p className="text-xs font-medium text-amber-700">⚙️ Dev mode — all tools visible</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="px-5 pt-7 pb-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] flex items-center gap-1.5" style={{ color: '#7c3aed' }}>
            <span>✦</span> AI-powered tools
          </p>
          <h1 data-testid="landing-headline" className="tp-ink text-[32px] font-extrabold leading-[1.05] tracking-tight mt-2">
            Make little tools for real life.
          </h1>
          <p className="tp-ink-2 text-sm mt-2.5 leading-relaxed max-w-xs">
            Just tell Toolie what you need. It builds the tool, you use it — share it and keep going together.
          </p>
          {onSignIn && (
            <button
              data-testid="signin-link"
              onClick={onSignIn}
              className="mt-3.5 tp-glass tp-ink text-xs font-semibold px-4 py-2 rounded-full active:scale-95 transition-transform"
            >
              Already have an account? Sign in →
            </button>
          )}
        </div>

        {/* ── Flagship cards ───────────────────────────────────────────────── */}
        <div className="px-4 flex flex-col gap-3.5 pb-5">

          <FlagshipCard
            testId="flagship-idea-board"
            emoji="💡"
            accent="#7c3aed" accentSoft="#f5f3ff"
            kicker="Ideas"
            title="Idea Brainstorm Board"
            desc="Turn a rough idea into a visual plan — who it's for, risks, ways to make money, and what to build first."
            chips={['❤️ Health score', '🗺️ Visual map', '💰 Money ideas']}
            ctaText="Map an idea"
            ctaTestId="open-idea-board-btn"
            onClick={onOpenIdeaBoard}
            disabled={isGenerating || !onOpenIdeaBoard}
          />

          <FlagshipCard
            testId="flagship-recipe"
            emoji="🍳"
            accent="#e11d48" accentSoft="#fff1f2"
            kicker="Cooking"
            title="Recipe Extractor"
            desc="Paste a cooking-video link and get a clean, editable recipe — ingredients, steps and a shopping list."
            chips={['📝 Clear steps', '✅ Checklist', '🛒 Shopping list']}
            ctaText="Extract a recipe"
            ctaTestId="open-recipe-btn"
            onClick={onOpenRecipe}
            disabled={isGenerating || !onOpenRecipe}
          />

          <FlagshipCard
            testId="flagship-world-cup-pool"
            emoji="🏆"
            accent="#ca8a04" accentSoft="#fefce8"
            kicker="FIFA 2026"
            title="World Cup Pool"
            desc="A fair seeded draw, results tracking and a live leaderboard. Share with family or workmates."
            chips={['🎲 Seeded draw', '📊 Leaderboard', '🔗 Share']}
            ctaText="Make a World Cup Pool"
            ctaTestId="make-world-cup-pool-btn"
            onClick={handleWCPool}
            disabled={isGenerating}
          />

          <FlagshipCard
            testId="flagship-partner-challenge"
            emoji="🏃"
            accent="#059669" accentSoft="#ecfdf5"
            kicker="Fitness"
            title="Partner Challenge"
            desc="Set a weekly goal with your partner. Log every walk, run or gym session, earn points and stay neck and neck."
            chips={['🎯 Weekly goal', '🏅 Points', '📈 Leaderboard']}
            ctaText="Start a Partner Challenge"
            ctaTestId="make-partner-challenge-btn"
            onClick={handlePartnerChallenge}
            disabled={isGenerating}
          />
        </div>

        {/* ── Toolie nudge ─────────────────────────────────────────────────── */}
        <div className="px-4 pb-5">
          <button
            onClick={onOpenChat}
            disabled={!onOpenChat}
            className="w-full flex items-center gap-3 tp-card rounded-[20px] px-4 py-3.5 active:scale-[0.99] transition-transform text-left"
          >
            <span
              className="w-10 h-10 rounded-[14px] flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: '#f5f3ff', boxShadow: '0 8px 20px rgba(124,58,237,0.22)' }}
            >
              ✨
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold tp-ink leading-tight">Want something else?</p>
              <p className="text-xs tp-ink-2 mt-0.5">Just tell Toolie — it can build almost anything.</p>
            </div>
            <span className="tp-ink-3 text-sm flex-shrink-0">→</span>
          </button>
        </div>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <div data-testid="how-it-works" className="px-5 pb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 tp-divider" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] tp-ink-3">How it works</p>
            <div className="h-px flex-1 tp-divider" />
          </div>
          <div className="flex flex-col gap-3.5">
            {[
              { step: '1', label: 'Describe what you want to Toolie', icon: '💬', sub: 'In plain English — no tech knowledge needed' },
              { step: '2', label: 'Toolie builds it instantly', icon: '✨', sub: 'A real working tool, not just a template' },
              { step: '3', label: 'Share it and keep it going', icon: '🔗', sub: 'Everyone stays in sync in real time' },
            ].map(({ step, label, icon, sub }) => (
              <div key={step} className="flex items-start gap-3.5">
                <div className="relative w-11 h-11 rounded-[15px] tp-glass flex items-center justify-center text-base flex-shrink-0" style={{ boxShadow: '0 8px 20px rgba(124,58,237,0.18)' }}>
                  {icon}
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full tp-btn-dark text-[10px] font-bold flex items-center justify-center">{step}</span>
                </div>
                <div className="pt-0.5">
                  <p className="text-sm font-bold tp-ink">{label}</p>
                  <p className="text-xs tp-ink-2 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Trust note ───────────────────────────────────────────────────── */}
        <div className="mx-4 mb-6 tp-card rounded-[18px] px-4 py-3.5">
          <p className="text-xs tp-ink-2 leading-relaxed">
            <span className="font-bold tp-ink">🔒 You own what you create.</span>
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
                  className="flex flex-col items-start gap-1.5 p-4 rounded-2xl border border-gray-100 bg-white active:bg-gray-50 text-left transition-colors disabled:opacity-50"
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
                  className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
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

// ── Velix flagship card ───────────────────────────────────────────────────────

interface FlagshipCardProps {
  testId: string;
  emoji: string;
  accent: string;
  accentSoft: string;
  kicker: string;
  title: string;
  desc: string;
  chips: string[];
  ctaText: string;
  ctaTestId: string;
  onClick?: () => void;
  disabled?: boolean;
}

function FlagshipCard({ testId, emoji, accent, accentSoft, kicker, title, desc, chips, ctaText, ctaTestId, onClick, disabled }: FlagshipCardProps) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left tp-card rounded-[24px] p-[18px] active:scale-[0.99] transition-transform disabled:opacity-50"
    >
      <div className="flex items-start gap-3.5">
        <span
          className="w-12 h-12 rounded-[16px] flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: accentSoft, boxShadow: `0 10px 24px ${accent}33` }}
        >
          {emoji}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>{kicker}</p>
          <h3 className="text-lg font-extrabold tp-ink tracking-tight leading-tight">{title}</h3>
        </div>
      </div>

      <p className="text-[13px] tp-ink-2 mt-3 leading-relaxed">{desc}</p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {chips.map(c => (
          <span key={c} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: accentSoft, color: accent }}>
            {c}
          </span>
        ))}
      </div>

      <div data-testid={ctaTestId} className="mt-4 flex items-center justify-between">
        <span className="text-sm font-bold tp-ink">{ctaText}</span>
        <span className="w-8 h-8 rounded-full tp-btn-dark flex items-center justify-center text-sm">→</span>
      </div>
    </button>
  );
}
