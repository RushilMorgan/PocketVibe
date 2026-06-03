import React, { useState } from 'react';
import { IDEA_CATEGORIES, IDEA_INTENTS } from '../lib/ideaBoardPrompt';

interface IdeaIntakeSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen category label, idea description, and intent id. */
  onSubmit: (categoryLabel: string, idea: string, intentId: string) => void;
}

/**
 * Guided intake for the Idea Thinking Board.
 *
 * Step 1: describe your idea + pick a category (optional)
 * Step 2: pick what you want to get out of it (intent)
 *
 * The intent question is the key addition — it drives completely different AI
 * framing, so "LangGraph vs LangChain" produces a comparison board, not a
 * business pitch.
 */
export function IdeaIntakeSheet({ open, onClose, onSubmit }: IdeaIntakeSheetProps) {
  const [step, setStep] = useState<'describe' | 'intent'>('describe');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [idea, setIdea] = useState('');
  const [intentId, setIntentId] = useState<string | null>(null);

  if (!open) return null;

  const category = IDEA_CATEGORIES.find(c => c.id === categoryId) ?? null;
  const canProceed = idea.trim().length > 0;
  const canBuild   = intentId !== null;

  function goToIntent() {
    if (!canProceed) return;
    setStep('intent');
  }

  function handleBuild() {
    if (!canBuild) return;
    onSubmit(category?.label ?? '', idea.trim(), intentId!);
    // Reset for next time
    setCategoryId(null);
    setIdea('');
    setIntentId(null);
    setStep('describe');
  }

  function handleClose() {
    onClose();
    // Keep entered text so the user doesn't lose it if they accidentally dismiss
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Sheet */}
      <div
        data-testid="idea-intake-sheet"
        className="relative bg-gray-950 rounded-t-3xl shadow-2xl flex flex-col max-h-[88%] z-10 border-t border-violet-500/20"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {step === 'describe' ? (
          <>
            {/* Header */}
            <div className="px-5 pb-3 pt-2 flex-shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">💡</span>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">Idea Thinking Board</p>
              </div>
              <h3 className="text-lg font-bold text-white leading-tight">What are you exploring?</h3>
              <p className="text-xs text-white/45 mt-0.5">
                Describe it — a business idea, a question, something you want to understand.
              </p>
            </div>

            <div className="overflow-y-auto px-5 pb-2 min-h-0">
              {/* Category chips */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {IDEA_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    data-testid={`idea-category-${cat.id}`}
                    onClick={() => setCategoryId(prev => prev === cat.id ? null : cat.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border text-left transition-colors ${
                      categoryId === cat.id
                        ? 'bg-violet-600 border-violet-400 text-white'
                        : 'bg-white/5 border-white/10 text-white/70 active:bg-white/10'
                    }`}
                  >
                    <span className="text-lg leading-none flex-shrink-0">{cat.emoji}</span>
                    <span className="text-sm font-semibold leading-tight">{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* Idea description */}
              <label className="block text-xs font-semibold text-white/50 mb-1.5 px-1">
                Describe it in a sentence or two
              </label>
              <textarea
                data-testid="idea-description-input"
                value={idea}
                onChange={e => setIdea(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder={
                  category
                    ? `e.g. ${exampleFor(category.id)}`
                    : 'e.g. An app that reminds elderly relatives to take medication… or the differences between LangGraph and LangChain…'
                }
                className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Next button */}
            <div className="px-5 pt-2 pb-6 flex-shrink-0">
              <button
                data-testid="idea-next-btn"
                onClick={goToIntent}
                disabled={!canProceed}
                className="w-full py-3.5 rounded-2xl bg-violet-500 text-white text-sm font-black active:bg-violet-600 disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pb-3 pt-2 flex-shrink-0">
              <button
                onClick={() => setStep('describe')}
                className="text-xs text-white/40 mb-2 active:text-white/60"
              >
                ← Back
              </button>
              <h3 className="text-lg font-bold text-white leading-tight">What do you want from this?</h3>
              <p className="text-xs text-white/45 mt-0.5">
                This shapes everything Toolie builds for you.
              </p>
            </div>

            <div className="overflow-y-auto px-5 pb-2 min-h-0">
              <div className="flex flex-col gap-2">
                {IDEA_INTENTS.map(intent => (
                  <button
                    key={intent.id}
                    data-testid={`idea-intent-${intent.id}`}
                    onClick={() => setIntentId(intent.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-colors ${
                      intentId === intent.id
                        ? 'bg-violet-600 border-violet-400 text-white'
                        : 'bg-white/5 border-white/10 text-white/70 active:bg-white/10'
                    }`}
                  >
                    <span className="text-2xl leading-none flex-shrink-0">{intent.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight">{intent.label}</p>
                      <p className="text-xs text-white/45 mt-0.5">{intent.description}</p>
                    </div>
                    {intentId === intent.id && (
                      <span className="ml-auto text-white/80 flex-shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Build button */}
            <div className="px-5 pt-3 pb-6 flex-shrink-0">
              <button
                data-testid="build-idea-board-btn"
                onClick={handleBuild}
                disabled={!canBuild}
                className="w-full py-3.5 rounded-2xl bg-violet-500 text-white text-sm font-black active:bg-violet-600 disabled:opacity-40 disabled:active:bg-violet-500 transition-colors flex items-center justify-center gap-2"
              >
                ✨ Build my board
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function exampleFor(categoryId: string): string {
  switch (categoryId) {
    case 'business':    return 'A coffee cart that sets up outside office parks in the mornings';
    case 'app':         return 'An app that reminds you to check in on elderly relatives';
    case 'side-hustle': return 'Selling custom birthday cakes from home on weekends';
    case 'product':     return 'A reusable lunchbox that keeps food warm for 6 hours';
    case 'service':     return 'A dog-walking service for busy professionals in my area';
    case 'event':       return 'A monthly board-game night that could become a paid club';
    case 'creative':    return 'A podcast about local food spots in my city';
    default:            return 'An idea that solves a problem I keep running into';
  }
}
