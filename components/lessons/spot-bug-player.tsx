'use client';

import { useState } from 'react';
import type { SpotBug } from '@/lib/lessons/schema';
import { BigButton, EndScreen, haptic, Intro, LessonShell, Verdict, type PlayerProps } from './shell';

type Stage = 'intro' | 'hunting' | 'end';

/**
 * The spot-the-bug template: tap the one broken line; then see why it's wrong
 * and the fixed line as a small diff.
 */
export function SpotBugPlayer({ lesson: bug, itemHref, itemKind, onFinish, onAnother, anotherState }: PlayerProps<SpotBug>) {
  const [stage, setStage] = useState<Stage>('intro');
  const [picked, setPicked] = useState<number | null>(null);
  const right = picked === bug.bug_line;

  function pick(line: number) {
    if (picked !== null) return;
    haptic();
    setPicked(line);
  }

  function finish() {
    setStage('end');
    onFinish(right ? 1 : 0);
  }

  return (
    <LessonShell itemHref={itemHref} done={stage === 'end' ? 1 : 0} total={1}>
      {stage === 'intro' && (
        <Intro kicker="Spot the bug" concept={bug.concept} intro={bug.intro} start="Find the broken line" onStart={() => setStage('hunting')} />
      )}

      {stage === 'hunting' && (
        <>
          <div className="flex-1 pt-2">
            <p className="text-sm text-muted">
              {picked === null ? 'One line is wrong. Tap it.' : right ? 'Spotted it.' : 'The bug was elsewhere.'}
            </p>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface py-2 font-mono text-[15px]">
              <p className="px-4 pb-1 text-xs uppercase tracking-wide text-muted">{bug.language}</p>
              <ol>
                {bug.code.map((line, i) => {
                  const isBug = i === bug.bug_line;
                  const isPicked = i === picked;
                  const tone =
                    picked === null
                      ? 'active:bg-accent/10'
                      : isBug
                        ? isPicked
                          ? 'bg-success/15'
                          : 'bg-danger/15'
                        : isPicked
                          ? 'bg-line'
                          : 'opacity-60';
                  return (
                    <li key={i}>
                      <button
                        onClick={() => pick(i)}
                        disabled={picked !== null}
                        aria-label={`Line ${i + 1}: ${line.trim() || 'blank'}`}
                        className={`flex min-h-11 w-full items-center gap-3 px-4 text-left ${tone}`}
                      >
                        <span aria-hidden className="w-5 shrink-0 text-right text-xs text-muted">
                          {i + 1}
                        </span>
                        <span className="whitespace-pre">{line || ' '}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {picked !== null && (
              <Verdict right={right}>
                <p>{bug.why}</p>
                <div className="mt-3 overflow-x-auto rounded-lg bg-bg p-3 font-mono text-sm">
                  <p className="whitespace-pre text-danger">- {bug.code[bug.bug_line].trim()}</p>
                  <p className="whitespace-pre text-success">+ {bug.fix.trim()}</p>
                </div>
              </Verdict>
            )}
          </div>
          {picked !== null && (
            <div className="pt-4">
              <BigButton onClick={finish}>Finish</BigButton>
            </div>
          )}
        </>
      )}

      {stage === 'end' && (
        <EndScreen
          score={right ? 1 : 0}
          total={1}
          takeaway={bug.takeaway}
          current="spot_bug"
          itemHref={itemHref}
          itemKind={itemKind}
          onAnother={onAnother}
          anotherState={anotherState}
        />
      )}
    </LessonShell>
  );
}
