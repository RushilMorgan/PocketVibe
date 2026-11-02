'use client';

import { useMemo, useRef, useState } from 'react';
import { shuffledOrder, type Order } from '@/lib/lessons/schema';
import { BigButton, EndScreen, haptic, Intro, LessonShell, type PlayerProps } from './shell';

type Stage = 'intro' | 'sorting' | 'checked' | 'end';

/** Moves the item at `from` to `to`. */
function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The order template: drag shuffled steps into order (or use the arrows),
 * Check shows which are in the right place, then the correct order with why.
 */
export function OrderPlayer({ lesson, itemHref, itemKind, onFinish, onAnother, anotherState }: PlayerProps<Order>) {
  const total = lesson.steps.length;
  const initial = useMemo(() => shuffledOrder(total, Date.now()), [total]);
  const [order, setOrder] = useState<number[]>(initial);
  const [stage, setStage] = useState<Stage>('intro');
  const [dragging, setDragging] = useState<number | null>(null);
  // The live drag index. A ref, because pointermove can fire before React
  // re-renders with the new state (fast swipes would otherwise be ignored).
  const dragRef = useRef<number | null>(null);
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  const score = order.filter((step, i) => step === i).length;

  function startDrag(e: React.PointerEvent, index: number) {
    if (stage !== 'sorting') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = index;
    setDragging(index);
    haptic();
  }

  /** While dragging, swap past any row whose midpoint the pointer crosses. */
  function onDrag(e: React.PointerEvent) {
    const from = dragRef.current;
    if (from === null) return;
    const y = e.clientY;
    const over = rows.current.findIndex((row) => {
      if (!row) return false;
      const r = row.getBoundingClientRect();
      return y >= r.top && y <= r.bottom;
    });
    if (over !== -1 && over !== from) {
      dragRef.current = over;
      setOrder((o) => move(o, from, over));
      setDragging(over);
    }
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(null);
  }

  function nudge(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= total) return;
    setOrder((o) => move(o, index, to));
  }

  function check() {
    haptic();
    setStage('checked');
  }

  function finish() {
    setStage('end');
    onFinish(score);
  }

  const done = stage === 'intro' ? 0 : stage === 'sorting' ? 0 : total;

  return (
    <LessonShell itemHref={itemHref} done={stage === 'checked' ? score : done} total={total}>
      {stage === 'intro' && (
        <Intro
          kicker="2-minute puzzle"
          concept={lesson.concept}
          intro={lesson.intro}
          start={`Put ${total} steps in order`}
          onStart={() => setStage('sorting')}
        />
      )}

      {(stage === 'sorting' || stage === 'checked') && (
        <>
          <div className="flex-1 pt-2">
            <p className="text-sm text-muted">
              {stage === 'sorting' ? 'Drag the steps into the right order.' : `${score} of ${total} in the right place.`}
            </p>
            <ol className="mt-4 flex flex-col gap-2" onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
              {order.map((step, i) => {
                const right = step === i;
                const tone =
                  stage === 'checked'
                    ? right
                      ? 'border-success bg-success/10'
                      : 'border-danger bg-danger/10'
                    : dragging === i
                      ? 'border-accent bg-surface shadow-lg scale-[1.02]'
                      : 'border-line bg-surface';
                return (
                  <li
                    key={step}
                    ref={(el) => {
                      rows.current[i] = el;
                    }}
                    className={`flex items-center gap-2 rounded-2xl border-2 py-2 pr-2 pl-1 transition-[transform,box-shadow] ${tone}`}
                  >
                    <span
                      onPointerDown={(e) => startDrag(e, i)}
                      aria-hidden
                      className={`flex h-11 w-8 shrink-0 items-center justify-center text-lg text-muted ${stage === 'sorting' ? 'cursor-grab touch-none' : ''}`}
                    >
                      {stage === 'checked' ? (right ? '✓' : '✕') : '⋮⋮'}
                    </span>
                    <span className="flex-1 leading-snug">{lesson.steps[step].text}</span>
                    {stage === 'sorting' && (
                      <span className="flex flex-col">
                        <button
                          onClick={() => nudge(i, -1)}
                          disabled={i === 0}
                          aria-label={`Move "${lesson.steps[step].text}" up`}
                          className="px-2 text-muted disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => nudge(i, 1)}
                          disabled={i === total - 1}
                          aria-label={`Move "${lesson.steps[step].text}" down`}
                          className="px-2 text-muted disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>

            {stage === 'checked' && (
              <div className="mt-6 rounded-2xl bg-surface p-4">
                <p className="font-semibold">The right order</p>
                <ol className="mt-2 flex flex-col gap-2.5">
                  {lesson.steps.map((s, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent">
                        {i + 1}
                      </span>
                      <span>
                        <span className="font-medium">{s.text}</span>
                        <span className="block text-sm text-muted">{s.why}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
          <div className="pt-4">
            {stage === 'sorting' ? <BigButton onClick={check}>Check my order</BigButton> : <BigButton onClick={finish}>See how you did</BigButton>}
          </div>
        </>
      )}

      {stage === 'end' && (
        <EndScreen
          score={score}
          total={total}
          takeaway={lesson.takeaway}
          current="order"
          itemHref={itemHref}
          itemKind={itemKind}
          onAnother={onAnother}
          anotherState={anotherState}
        />
      )}
    </LessonShell>
  );
}
