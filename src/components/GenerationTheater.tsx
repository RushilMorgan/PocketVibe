import { Fragment } from 'react';
import type { GenerationStageEvent } from '../types';
import { stageLabel } from '../services/aiService';
import { buildStageTimeline } from '../lib/stageTimeline';
import { ThinkingDots } from './shared/ThinkingDots';

interface GenerationTheaterProps {
  stageEvents: GenerationStageEvent[];
  /** Fallback status line when no structured events are available (dev/legacy path). */
  status: string | null;
}

/**
 * Live narration of the real generation pipeline — each line is a stage the
 * server actually ran, with the decisions it made along the way.
 */
export function GenerationTheater({ stageEvents, status }: GenerationTheaterProps) {
  const timeline = buildStageTimeline(stageEvents, stageLabel);
  const hasTimeline = timeline.length > 0;

  return (
    <div
      data-testid="generation-theater"
      className="flex-shrink-0 mx-4 mt-3 rounded-2xl bg-gradient-to-br from-violet-600 via-violet-600 to-indigo-700 p-4 text-white shadow-lg shadow-violet-600/20 overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg animate-pulse" aria-hidden="true">✨</span>
        <span className="text-sm font-bold">Toolie is on it</span>
      </div>

      {hasTimeline ? (
        <ol className="flex flex-col gap-2" aria-live="polite">
          {timeline.map((item, i) => {
            const isCurrent = i === timeline.length - 1 && !item.done;
            return (
              <li key={item.key + String(i)} className="flex items-center gap-2 animate-fade-in">
                {item.done ? (
                  <span
                    className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 animate-check-pop"
                    aria-hidden="true"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin flex-shrink-0" aria-hidden="true" />
                )}
                <span className={`text-sm ${item.done ? 'text-white/80' : 'font-semibold'}`}>
                  {item.label}
                </span>
                {isCurrent && <ThinkingDots />}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm font-semibold flex items-center" aria-live="polite">
          {status ?? 'Making something for you…'}
          <ThinkingDots />
        </p>
      )}

      {/* The creation taking shape — shimmer placeholder for what's coming */}
      <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
        {['w-2/5', 'w-full', 'w-4/5'].map((width, i) => (
          <Fragment key={i}>
            <div className={`h-3 ${width} rounded-full shimmer-block`} style={{ animationDelay: `${i * 0.2}s` }} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
