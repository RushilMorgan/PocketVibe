'use client';

import { useEffect, useRef, useState } from 'react';
import type { Quiz } from '@/lib/lessons/schema';
import { BigButton, EndScreen, haptic, Intro, LessonShell, Verdict, type PlayerProps } from './shell';

type Stage = { kind: 'intro' } | { kind: 'question'; index: number; picked: number | null } | { kind: 'end' };

const LETTERS = ['A', 'B', 'C'];

/**
 * The quiz template: intro → one question per screen with instant
 * right/wrong and the why → score + takeaway. Renders any valid Quiz JSON.
 */
export function QuizPlayer({ lesson: quiz, itemHref, itemKind, onFinish, onAnother, anotherState }: PlayerProps<Quiz>) {
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

  const done =
    stage.kind === 'intro' ? 0 : stage.kind === 'end' ? total : stage.index + (stage.picked !== null ? 1 : 0);

  return (
    <LessonShell itemHref={itemHref} done={done} total={total}>
      {stage.kind === 'intro' && (
        <Intro
          kicker="2-minute quiz"
          concept={quiz.concept}
          intro={quiz.intro}
          start={`Start · ${total} questions`}
          onStart={() => setStage({ kind: 'question', index: 0, picked: null })}
        />
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
        <EndScreen
          score={score}
          total={total}
          takeaway={quiz.takeaway}
          current="quiz"
          itemHref={itemHref}
          itemKind={itemKind}
          onAnother={onAnother}
          anotherState={anotherState}
        />
      )}
    </LessonShell>
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

        {answered && <Verdict right={picked === question.answer}>{question.why}</Verdict>}
      </div>
      <div className="pt-4">{children}</div>
    </>
  );
}
