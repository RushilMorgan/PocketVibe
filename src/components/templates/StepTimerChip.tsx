import { formatCountdown, formatDurationShort } from '../../lib/stepDuration';
import type { TimerPhase } from '../../hooks/useStepTimers';

interface StepTimerChipProps {
  seconds: number;
  phase: TimerPhase;
  remaining: number;
  /** Nudge text once the timer is done (view-specific). */
  doneLabel: string;
  onStart: () => void;
  onCancel: () => void;
  /** Tap on the done-nudge: dismiss, or advance in step view. */
  onDone: () => void;
}

/** Tappable per-step timer: start → live countdown → pulsing "time's up" nudge. */
export function StepTimerChip({ seconds, phase, remaining, doneLabel, onStart, onCancel, onDone }: StepTimerChipProps) {
  if (phase === 'running') {
    return (
      <span className="inline-flex items-center gap-1" data-testid="step-timer-running">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full tabular-nums">
          ⏳ {formatCountdown(remaining)}
        </span>
        <button
          onClick={onCancel}
          aria-label="Cancel timer"
          className="w-5 h-5 rounded-full text-gray-300 hover:text-red-500 text-sm font-bold leading-none"
        >
          ×
        </button>
      </span>
    );
  }
  if (phase === 'done') {
    return (
      <button
        onClick={onDone}
        data-testid="step-timer-done"
        className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full animate-pulse active:bg-amber-200"
      >
        ⏰ {doneLabel}
      </button>
    );
  }
  return (
    <button
      onClick={onStart}
      data-testid="step-timer-start"
      className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-full active:bg-violet-100"
    >
      ⏱️ Start {formatDurationShort(seconds)} timer
    </button>
  );
}
