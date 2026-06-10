import React, { useState } from 'react';
import { BottomSheet } from './shared/BottomSheet';
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
    <BottomSheet open={open} onClose={handleClose} testId="idea-intake-sheet" accent="violet">

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
                What's the idea? Describe it in a sentence or two.
              </label>
              <textarea
                data-testid="idea-description-input"
                value={idea}
                onChange={e => setIdea(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="Just describe it in plain words — no need to make it perfect."
                className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
              />

              {/* Starter examples — shown when textarea is empty to beat blank-canvas anxiety */}
              {!idea.trim() && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold text-white/35 mb-2 px-1">
                    ✦ Not sure what to write? Tap one to get started:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {startersFor(categoryId).map((starter, i) => (
                      <button
                        key={i}
                        data-testid={`idea-starter-${i}`}
                        onClick={() => setIdea(starter.text)}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-left active:bg-white/10 transition-colors"
                      >
                        <span className="text-base leading-none flex-shrink-0 mt-0.5">{starter.emoji}</span>
                        <span className="text-xs text-white/65 leading-relaxed">{starter.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
    </BottomSheet>
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

interface Starter { emoji: string; text: string; }

/**
 * Tappable example starters — contextual to the selected category so they feel
 * personally relevant. When no category is selected, a diverse mix is shown to
 * demonstrate the breadth of what Toolie can help with.
 */
function startersFor(categoryId: string | null): Starter[] {
  switch (categoryId) {
    case 'business':
      return [
        { emoji: '☕', text: 'A coffee cart that sets up outside office parks in the mornings' },
        { emoji: '🧹', text: 'A cleaning service for Airbnbs and short-term rentals in my area' },
        { emoji: '🎂', text: 'A custom cake business I run from home on weekends' },
      ];
    case 'app':
      return [
        { emoji: '👴', text: 'An app that helps elderly people stay connected with family easily' },
        { emoji: '💊', text: 'A medication reminder app for people managing chronic conditions' },
        { emoji: '🏠', text: 'An app that helps tenants and landlords communicate without drama' },
      ];
    case 'side-hustle':
      return [
        { emoji: '🎨', text: 'Selling handmade candles or soaps online and at markets' },
        { emoji: '📸', text: 'Charging for photography at family events and small businesses' },
        { emoji: '✏️', text: 'Tutoring school kids in maths and science on afternoons' },
      ];
    case 'product':
      return [
        { emoji: '🥗', text: 'A meal prep container that actually keeps food fresh for 3 days' },
        { emoji: '👜', text: 'A bag designed specifically for people who work from coffee shops' },
        { emoji: '🌱', text: 'A simple starter kit that makes it easy to grow herbs at home' },
      ];
    case 'service':
      return [
        { emoji: '🐕', text: 'Dog walking and pet care for busy professionals in my neighbourhood' },
        { emoji: '🚗', text: 'A mobile car wash that comes to people at their office or home' },
        { emoji: '👩‍💻', text: 'Helping small businesses get set up on social media and online' },
      ];
    case 'event':
      return [
        { emoji: '🎲', text: 'A monthly board game night that could turn into a regular paid club' },
        { emoji: '🍷', text: 'A wine and food pairing evening for people who want to learn more' },
        { emoji: '🧘', text: 'A weekend wellness retreat focused on stress and burnout recovery' },
      ];
    case 'creative':
      return [
        { emoji: '🎙️', text: 'A podcast about hidden gems, local food spots, and culture in my city' },
        { emoji: '✍️', text: 'A newsletter about personal finance written for people in their 20s' },
        { emoji: '🎥', text: 'Short videos teaching practical life skills nobody taught us in school' },
      ];
    default:
      // No category selected — show a diverse mix covering different use cases
      return [
        { emoji: '💼', text: 'A coffee cart that sets up outside office parks in the mornings' },
        { emoji: '🤔', text: 'Should I leave my job to freelance full-time, or keep both going?' },
        { emoji: '📱', text: 'The difference between building a mobile app and a web app' },
        { emoji: '🎂', text: 'A home cake business I want to start on weekends' },
      ];
  }
}
