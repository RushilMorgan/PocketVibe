'use client';

import { useState } from 'react';
import type { Simulator } from '@/lib/lessons/schema';
import { BigButton, EndScreen, haptic, Intro, LessonShell, type PlayerProps } from './shell';

/**
 * The simulator template: the system's parts as a chain of boxes; each Next
 * moves the highlight to the part doing the work and says what's happening.
 */
export function SimulatorPlayer({ lesson: sim, itemHref, itemKind, onFinish, onAnother, anotherState }: PlayerProps<Simulator>) {
  // -1 = intro, states.length = end.
  const [at, setAt] = useState(-1);
  const total = sim.states.length;
  const state = sim.states[at];

  function go(to: number) {
    haptic();
    if (to === total) onFinish(1);
    setAt(to);
  }

  return (
    <LessonShell itemHref={itemHref} done={Math.max(0, Math.min(at + 1, total))} total={total}>
      {at === -1 && (
        <Intro kicker="2-minute simulator" concept={sim.concept} intro={sim.intro} start="Run it step by step" onStart={() => go(0)} />
      )}

      {state && (
        <>
          <div className="flex-1 pt-2">
            <ol className="flex flex-col items-center" aria-label="System parts">
              {sim.nodes.map((node, i) => {
                const active = node.id === state.highlight;
                return (
                  <li key={node.id} className="flex flex-col items-center">
                    {i > 0 && <span aria-hidden className="h-4 w-0.5 bg-line" />}
                    <span
                      aria-current={active ? 'step' : undefined}
                      className={`rounded-xl border-2 px-4 py-2 text-center font-medium transition-all duration-300 ${
                        active ? 'scale-105 border-accent bg-accent text-on-accent shadow-lg' : 'border-line bg-surface text-muted'
                      }`}
                    >
                      {node.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            <div aria-live="polite" className="mt-6 rounded-2xl bg-surface p-4">
              <p className="text-sm text-muted">
                Step {at + 1} of {total}
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-snug">{state.label}</h2>
              <p className="mt-2 text-lg leading-relaxed">{state.happening}</p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            {at > 0 && (
              <button onClick={() => go(at - 1)} className="rounded-2xl border border-line px-5 font-medium text-muted">
                Back
              </button>
            )}
            <BigButton onClick={() => go(at + 1)}>{at + 1 < total ? 'Next' : 'Finish'}</BigButton>
          </div>
        </>
      )}

      {at === total && (
        <EndScreen
          headline="You ran the whole system."
          takeaway={sim.takeaway}
          current="simulator"
          itemHref={itemHref}
          itemKind={itemKind}
          onAnother={onAnother}
          anotherState={anotherState}
        />
      )}
    </LessonShell>
  );
}
