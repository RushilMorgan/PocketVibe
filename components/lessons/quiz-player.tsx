'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Quiz } from '@/lib/lessons/schema';

type Stage = { kind: 'intro' } | { kind: 'question'; index: number; picked: number | null } | { kind: 'end' };

const LETTERS = ['A', 'B', 'C'];

/** A light tap on each answer, where the device supports it. */
function haptic() {
  try {
    navigator.vibrate?.(20);
  } catch {}
}

function verdict(score: number, total: number): string {
  if (score === total) return 'Perfect. You’ve got this one.';
  if (score >= total - 1) return 'Nearly flawless.';
  if (score >= Math.ceil(total / 2)) return 'Solid — the why notes fill the gaps.';
  return 'Tricky one. Worth another go.';
}

/**
 * The fixed quiz template: intro → one question per screen with instant
 * right/wrong and the why → score + takeaway. Renders any valid Quiz JSON.
 */
export function QuizPlayer({
  quiz,
  itemHref,
  onFinish,
  onAnother,
  anotherState,
}: {
  quiz: Quiz;
  itemHref: string;
  onFinish: (score: number) => void;
  onAnother: () => void;
  anotherState: 'idle' | 'working' | 'failed';
}) {
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const [score, setScore] = useState(0);
  const total = quiz.questions.length;
  const nextRef = useRef<HTMLButtonElement>(null);

  // Move focus to Next after answering, for keyboard and screen-reader users.
  useEffect(() => {
    if (stage.kind === 'question' && stage.picked !== null) nextRef.current?.focus();
  }, [stage]);

  function pick(option: number) {
    if (stage.kind !== 'question' || stage.picked !== null) return;
    haptic();
    if (option === quiz.questions[stage.index].answer) setScore((s) => s + 1);
    setStage({ ...stage, picked: option });
  }

  function next() {
    if (stage.kind !== 'question') return;
    if (stage.index + 1 < total) {
      setStage({ kind: 'question', index: stage.index + 1, picked: null });
    } else {
      setStage({ kind: 'end' });
      onFinish(score);
    }
  }

  const step = stage.kind === 'intro' ? -1 : stage.kind === 'end' ? total : stage.index;

  return (
    <div className="fixed inset-0 flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
        <Link href={itemHref} aria-label="Close lesson" className="-ml-2 p-2 text-xl leading-none text-muted">
          ✕
        </Link>
        <ol className="flex flex-1 gap-1.5" aria-label={`Progress: ${Math.max(step, 0)} of ${total}`}>
          {quiz.questions.map((_, i) => (
            <li key={i} className={`h-1.5 flex-1 rounded-full ${i < step || (i === step && stage.kind === 'question' && stage.picked !== null) ? 'bg-accent' : 'bg-line'}`} />
          ))}
        </ol>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto px-5 pb-4">
        {stage.kind === 'intro' && (
          <>
            <div className="flex flex-1 flex-col justify-center">
              <p className="text-sm font-medium uppercase tracking-wide text-accent">2-minute lesson</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight">{quiz.concept}</h1>
              <p className="mt-4 text-lg leading-relaxed text-muted">{quiz.intro}</p>
            </div>
            <BigButton onClick={() => setStage({ kind: 'question', index: 0, picked: null })} autoFocus>
              Start · {total} questions
            </BigButton>
          </>
        )}

        {stage.kind === 'question' && (
          <Question
            key={stage.index}
            question={quiz.questions[stage.index]}
            number={stage.index + 1}
            total={total}
            picked={stage.picked}
            onPick={pick}
          >
            {stage.picked !== null && (
              <BigButton ref={nextRef} onClick={next}>
                {stage.index + 1 < total ? 'Next' : 'See how you did'}
              </BigButton>
            )}
          </Question>
        )}

        {stage.kind === 'end' && (
          <>
            <div className="flex flex-1 flex-col justify-center text-center">
              <p className="text-6xl font-semibold tracking-tight">
                {score}
                <span className="text-muted">/{total}</span>
              </p>
              <p className="mt-2 text-lg">{verdict(score, total)}</p>
              <div className="mt-8 rounded-2xl border border-line bg-surface p-5 text-left">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Remember this</p>
                <p className="mt-1.5 text-lg leading-snug">{quiz.takeaway}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <BigButton onClick={onAnother} disabled={anotherState === 'working'}>
                {anotherState === 'working' ? 'Writing a new one…' : 'Another on this topic'}
              </BigButton>
              {anotherState === 'failed' && <p className="text-center text-sm text-danger">Couldn&apos;t write another one — try again.</p>}
              <Link href={itemHref} className="rounded-2xl py-4 text-center font-medium text-muted">
                Back to item
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Question({
  question,
  number,
  total,
  picked,
  onPick,
  children,
}: {
  question: Quiz['questions'][number];
  number: number;
  total: number;
  picked: number | null;
  onPick: (i: number) => void;
  children: React.ReactNode;
}) {
  const answered = picked !== null;
  const right = picked === question.answer;

  return (
    <>
      <div className="flex-1 pt-4">
        <p className="text-sm text-muted">
          Question {number} of {total}
        </p>
        <h2 className="mt-2 text-2xl font-semibold leading-snug">{question.q}</h2>

        <ul className="mt-6 flex flex-col gap-3">
          {question.options.map((option, i) => {
            const isAnswer = i === question.answer;
            const isPicked = i === picked;
            const tone = !answered
              ? 'border-line bg-surface active:scale-[0.98]'
              : isAnswer
                ? 'border-success bg-success/10'
                : isPicked
                  ? 'border-danger bg-danger/10'
                  : 'border-line bg-surface opacity-50';
            return (
              <li key={i}>
                <button
                  onClick={() => onPick(i)}
                  disabled={answered}
                  aria-pressed={isPicked}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg transition ${tone}`}
                >
                  <span
                    aria-hidden
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      answered && isAnswer ? 'bg-success text-on-accent' : answered && isPicked ? 'bg-danger text-on-accent' : 'bg-bg text-muted'
                    }`}
                  >
                    {answered && isAnswer ? '✓' : answered && isPicked ? '✕' : LETTERS[i]}
                  </span>
                  {option}
                </button>
              </li>
            );
          })}
        </ul>

        {answered && (
          <div role="status" className="mt-5 rounded-2xl bg-surface p-4">
            <p className={`font-semibold ${right ? 'text-success' : 'text-danger'}`}>{right ? 'Right!' : 'Not quite.'}</p>
            <p className="mt-1 leading-relaxed">{question.why}</p>
          </div>
        )}
      </div>
      <div className="pt-4">{children}</div>
    </>
  );
}

function BigButton({
  ref,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      {...props}
      className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-on-accent active:scale-[0.99] disabled:opacity-60"
    >
      {children}
    </button>
  );
}
