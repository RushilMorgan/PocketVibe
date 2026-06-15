import { useState } from 'react';
import { BottomSheet } from './shared/BottomSheet';
import { MicButton } from './shared/MicButton';
import { IdeaShapeGuide } from './IdeaShapeGuide';
import { IDEA_CATEGORIES, IDEA_INTENTS } from '../lib/ideaBoardPrompt';
import { startersFor } from '../lib/ideaStarters';
import { suggestIntent } from '../lib/ideaIntentSuggest';

interface IdeaIntakeSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen category label, idea description, and intent id. */
  onSubmit: (categoryLabel: string, idea: string, intentId: string) => void;
}

/**
 * Guided intake for the Idea Thinking Board.
 *
 * The idea comes first: a free textarea (typed or spoken) with tappable
 * starters — the category chips sit below as an optional example filter, so
 * nobody has to classify their idea before they've said it. Users who freeze
 * at the blank box get a "let Toolie ask you a few questions" guide.
 * The intent step arrives pre-selected with a suggestion read from their text.
 */
export function IdeaIntakeSheet({ open, onClose, onSubmit }: IdeaIntakeSheetProps) {
  const [step, setStep] = useState<'describe' | 'guide' | 'intent'>('describe');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [idea, setIdea] = useState('');
  const [intentId, setIntentId] = useState<string | null>(null);
  const [suggestedId, setSuggestedId] = useState<string | null>(null);

  const category = IDEA_CATEGORIES.find(c => c.id === categoryId) ?? null;
  const canProceed = idea.trim().length > 0;
  const canBuild = intentId !== null;

  function goToIntent() {
    if (!canProceed) return;
    // Pre-select a suggestion read from how they wrote the idea — changeable
    const suggestion = suggestIntent(idea);
    setSuggestedId(suggestion);
    setIntentId(prev => prev ?? suggestion);
    setStep('intent');
  }

  function handleBuild() {
    if (!canBuild) return;
    onSubmit(category?.label ?? '', idea.trim(), intentId!);
    // Reset for next time
    setCategoryId(null);
    setIdea('');
    setIntentId(null);
    setSuggestedId(null);
    setStep('describe');
  }

  function handleClose() {
    onClose();
    // Keep entered text so the user doesn't lose it if they accidentally dismiss
  }

  return (
    <BottomSheet open={open} onClose={handleClose} testId="idea-intake-sheet" accent="violet">

        {step === 'guide' ? (
          <IdeaShapeGuide
            onBack={() => setStep('describe')}
            onDone={description => { setIdea(description); setStep('describe'); }}
          />
        ) : step === 'describe' ? (
          <>
            {/* Header */}
            <div className="px-5 pb-3 pt-2 flex-shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">💡</span>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] tp-ink-3">Idea Thinking Board</p>
              </div>
              <h3 className="text-lg font-extrabold tp-ink tracking-tight leading-tight">What are you exploring?</h3>
              <p className="text-xs tp-ink-3 mt-0.5">
                An idea, a question, a decision — anything you want to think through. Plain words are perfect.
              </p>
            </div>

            <div className="overflow-y-auto px-5 pb-2 min-h-0">
              {/* The idea comes first — typed or spoken */}
              <div className="flex items-end gap-2">
                <textarea
                  data-testid="idea-description-input"
                  value={idea}
                  onChange={e => setIdea(e.target.value)}
                  rows={3}
                  maxLength={400}
                  placeholder="Just describe it in plain words — no need to make it perfect."
                  className="tp-input flex-1 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2"
                  style={{ ['--tw-ring-color' as string]: 'rgba(22,21,15,0.18)' }}
                />
                <MicButton value={idea} onChange={setIdea} testId="idea-mic-btn" />
              </div>

              {!idea.trim() && (
                <>
                  {/* Frozen at the blank box? Toolie interviews you instead */}
                  <button
                    data-testid="idea-guide-btn"
                    onClick={() => setStep('guide')}
                    className="tp-card mt-2.5 w-full flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-left active:scale-[0.99] transition-transform"
                  >
                    <span className="text-lg leading-none flex-shrink-0">🤝</span>
                    <span className="text-xs tp-ink-2 leading-snug">
                      <span className="font-bold tp-ink">Not sure how to put it?</span> Let Toolie ask you a few quick questions.
                    </span>
                    <span className="ml-auto tp-ink-3 flex-shrink-0">→</span>
                  </button>

                  {/* Starter examples — beat blank-canvas anxiety */}
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold tp-ink-3 mb-2 px-1">
                      ✦ Or tap an example to get started:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {startersFor(categoryId).map((starter, i) => (
                        <button
                          key={i}
                          data-testid={`idea-starter-${i}`}
                          onClick={() => setIdea(starter.text)}
                          className="tp-glass flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left active:scale-[0.99] transition-transform"
                        >
                          <span className="text-base leading-none flex-shrink-0 mt-0.5">{starter.emoji}</span>
                          <span className="text-xs tp-ink-2 leading-relaxed">{starter.text}</span>
                        </button>
                      ))}
                    </div>

                    {/* Optional example filter — Toolie works the category out itself */}
                    <p className="text-[10px] font-semibold tp-ink-3 mt-3 mb-2 px-1">
                      Want examples for something specific? <span className="opacity-60">(optional)</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {IDEA_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          data-testid={`idea-category-${cat.id}`}
                          onClick={() => setCategoryId(prev => prev === cat.id ? null : cat.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-transform active:scale-95 ${
                            categoryId === cat.id ? 'tp-btn-dark' : 'tp-glass tp-ink'
                          }`}
                        >
                          <span className="leading-none">{cat.emoji}</span>
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Next button */}
            <div className="px-5 pt-2 pb-6 flex-shrink-0">
              <button
                data-testid="idea-next-btn"
                onClick={goToIntent}
                disabled={!canProceed}
                className="tp-btn-dark w-full py-3.5 rounded-2xl text-sm font-black active:scale-[0.99] disabled:opacity-40 transition-transform"
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
                className="text-xs tp-ink-3 mb-2 active:opacity-60"
              >
                ← Back
              </button>
              <h3 className="text-lg font-extrabold tp-ink tracking-tight leading-tight">What do you want from this?</h3>
              <p className="text-xs tp-ink-3 mt-0.5">
                Toolie suggested one from your description — change it if it's off.
              </p>
            </div>

            <div className="overflow-y-auto px-5 pb-2 min-h-0">
              <div className="flex flex-col gap-2">
                {IDEA_INTENTS.map(intent => {
                  const selected = intentId === intent.id;
                  return (
                    <button
                      key={intent.id}
                      data-testid={`idea-intent-${intent.id}`}
                      onClick={() => setIntentId(intent.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-transform active:scale-[0.99] ${
                        selected ? 'tp-btn-dark' : 'tp-glass tp-ink'
                      }`}
                    >
                      <span className="text-2xl leading-none flex-shrink-0">{intent.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-tight">{intent.label}</p>
                        <p className={`text-xs mt-0.5 ${selected ? 'text-white/65' : 'tp-ink-3'}`}>{intent.description}</p>
                      </div>
                      <span className="ml-auto flex-shrink-0 flex items-center gap-1.5">
                        {intent.id === suggestedId && (
                          <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${
                            selected ? 'bg-white/20 text-white' : 'bg-violet-50 text-violet-700'
                          }`}>
                            ✨ Suggested
                          </span>
                        )}
                        {selected && <span className="text-white/80">✓</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Build button */}
            <div className="px-5 pt-3 pb-6 flex-shrink-0">
              <button
                data-testid="build-idea-board-btn"
                onClick={handleBuild}
                disabled={!canBuild}
                className="tp-btn-dark w-full py-3.5 rounded-2xl text-sm font-black active:scale-[0.99] disabled:opacity-40 transition-transform flex items-center justify-center gap-2"
              >
                ✨ Build my board
              </button>
            </div>
          </>
        )}
    </BottomSheet>
  );
}
