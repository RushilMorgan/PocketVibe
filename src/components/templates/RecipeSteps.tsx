import { useState } from 'react';
import type { RecipeContent, RecipeStep, RecipeLayoutMode } from '../../types';
import { stepEmoji } from '../../lib/recipeIcons';
import { stepTimerSeconds } from '../../lib/stepDuration';
import { useStepTimers } from '../../hooks/useStepTimers';
import { uid } from '../../lib/uid';
import { celebrate } from '../../lib/celebrate';
import { StepTimerChip } from './StepTimerChip';

interface RecipeStepsProps {
  content: RecipeContent;
  editMode: boolean;
  onUpdate: (patch: Partial<RecipeContent>) => void;
  /** Tap-to-talk: prefill a question about a step. Absent when chat is off. */
  onAskAboutStep?: (prefill: string) => void;
}

/**
 * The recipe's Steps card: card / list / step layouts, manual editing, and
 * per-step cooking timers. Any step with a duration ("Bake for 20 minutes")
 * gets a tappable timer; when it runs out, the nudge fits the view — card and
 * list point at the next step below, the focus step view offers to advance.
 */
export function RecipeSteps({ content, editMode, onUpdate, onAskAboutStep }: RecipeStepsProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const layout: RecipeLayoutMode = content.layoutMode ?? 'card';
  const steps = content.steps;
  const safeStepIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));

  const lastStepId = steps[steps.length - 1]?.id;
  const timers = useStepTimers(id => {
    // The final step's timer ending means the dish is done — small celebration
    if (id === lastStepId) celebrate({ intensity: 'small' });
  });

  // ── Step CRUD (keep number 1..n) ────────────────────────────────────────
  function renumber(list: RecipeStep[]): RecipeStep[] {
    return list.map((s, idx) => ({ ...s, number: idx + 1 }));
  }
  function updateStep(id: string, field: 'text' | 'time', value: string) {
    onUpdate({ steps: steps.map(s => (s.id === id ? { ...s, [field]: value } : s)) });
  }
  function deleteStep(id: string) {
    onUpdate({ steps: renumber(steps.filter(s => s.id !== id)) });
  }
  function addStep() {
    const step: RecipeStep = { id: uid('st'), number: steps.length + 1, text: '' };
    onUpdate({ steps: [...steps, step] });
  }

  /** Timer chip for one step, with the view-appropriate done-nudge. */
  function renderTimer(s: RecipeStep, isLast: boolean) {
    const seconds = stepTimerSeconds(s);
    if (seconds == null) {
      // Unparseable time text still shows as a plain hint
      return s.time ? <span className="text-xs text-gray-400">⏱️ {s.time}</span> : null;
    }
    return (
      <StepTimerChip
        seconds={seconds}
        phase={timers.phase(s.id)}
        remaining={timers.remainingSeconds(s.id)}
        doneLabel={isLast ? "Time's up — all done! 🎉" : `Time's up — on to step ${s.number + 1} 👇`}
        onStart={() => timers.start(s.id, seconds)}
        onCancel={() => timers.cancel(s.id)}
        onDone={() => timers.dismiss(s.id)}
      />
    );
  }

  const current = steps[safeStepIndex];
  const currentSeconds = current ? stepTimerSeconds(current) : null;
  const currentIsLast = safeStepIndex >= steps.length - 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 text-sm">Steps</h3>
        {/* Layout switcher */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
          {(['card', 'list', 'step'] as RecipeLayoutMode[]).map(mode => (
            <button
              key={mode}
              data-testid={`recipe-layout-${mode}`}
              onClick={() => { onUpdate({ layoutMode: mode }); setStepIndex(0); }}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize transition-colors ${
                layout === mode ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 pt-1">
        {steps.length === 0 && !editMode && (
          <p className="text-center text-gray-400 text-sm py-4">No steps yet — ask Toolie below, or edit by hand.</p>
        )}

        {editMode ? (
          <div className="flex flex-col gap-2">
            {steps.map(s => (
              <div key={s.id} className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-1">{s.number}</span>
                <div className="flex-1">
                  <textarea value={s.text} placeholder="Describe this step…" onChange={e => updateStep(s.id, 'text', e.target.value)} rows={2}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none" />
                  <input value={s.time ?? ''} placeholder="time (optional, e.g. 5 min)" onChange={e => updateStep(s.id, 'time', e.target.value)}
                    className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-rose-400" />
                </div>
                <button onClick={() => deleteStep(s.id)} className="text-red-400 hover:text-red-600 p-1 mt-1" aria-label="Delete step">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            ))}
            <button data-testid="add-step-btn" onClick={addStep}
              className="w-full text-sm text-rose-600 font-semibold border-2 border-dashed border-rose-200 rounded-xl py-2 active:bg-rose-50">
              + Add step
            </button>
          </div>
        ) : layout === 'step' && steps.length > 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <span className="text-5xl leading-none">{current?.emoji || stepEmoji(current?.text ?? '')}</span>
            {/* Progress dots */}
            <div className="flex items-center gap-1">
              {steps.map((_, idx) => (
                <span key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === safeStepIndex ? 'bg-rose-600' : 'bg-gray-200'}`} />
              ))}
            </div>
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wide">
              Step {safeStepIndex + 1} of {steps.length}
            </span>
            <p className="text-base text-gray-800 leading-relaxed min-h-[4rem]">{current?.text}</p>

            {/* Timer — when done, the nudge advances to the next step */}
            {current && currentSeconds != null && timers.phase(current.id) === 'done' ? (
              <button
                data-testid="step-timer-next-nudge"
                onClick={() => {
                  timers.dismiss(current.id);
                  if (!currentIsLast) setStepIndex(i => Math.min(steps.length - 1, i + 1));
                }}
                className="px-4 py-2 rounded-xl bg-amber-100 border border-amber-300 text-sm font-bold text-amber-900 animate-pulse active:bg-amber-200"
              >
                {currentIsLast ? "⏰ Time's up — all done! 🎉" : "⏰ Time's up — Next step →"}
              </button>
            ) : current && currentSeconds != null ? (
              renderTimer(current, currentIsLast)
            ) : current?.time ? (
              <span className="text-xs text-gray-400">⏱️ {current.time}</span>
            ) : null}

            {onAskAboutStep && current && (
              <button onClick={() => onAskAboutStep(`About step ${safeStepIndex + 1} ("${current.text.slice(0, 40)}…"): `)}
                className="text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full active:bg-rose-100">
                💬 Ask about this step
              </button>
            )}
            <div className="flex items-center gap-3 mt-1">
              <button disabled={safeStepIndex === 0} onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 disabled:opacity-40 active:bg-gray-200">Prev</button>
              <button disabled={currentIsLast} onClick={() => setStepIndex(i => Math.min(steps.length - 1, i + 1))}
                className="px-4 py-2 rounded-xl bg-rose-600 text-sm font-semibold text-white disabled:opacity-40 active:bg-rose-700">Next</button>
            </div>
          </div>
        ) : (
          <ol className={layout === 'list' ? 'flex flex-col gap-1.5' : 'flex flex-col gap-3'}>
            {steps.map((s, idx) => (
              <li key={s.id} className="flex items-start gap-3">
                <span className="relative w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-base leading-none">{s.emoji || stepEmoji(s.text)}</span>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">{s.number}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-gray-800 ${layout === 'list' ? 'text-sm' : 'text-sm leading-relaxed'}`}>{s.text}</p>
                  <div className="mt-1 empty:hidden">{renderTimer(s, idx === steps.length - 1)}</div>
                </div>
                {onAskAboutStep && (
                  <button
                    onClick={() => onAskAboutStep(`About step ${s.number} ("${s.text.slice(0, 40)}…"): `)}
                    className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-xs hover:bg-rose-50 hover:border-rose-200 active:bg-rose-100"
                    aria-label="Ask about this step"
                    title="Ask Toolie"
                  >💬</button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
