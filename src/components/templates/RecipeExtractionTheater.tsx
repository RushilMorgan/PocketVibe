import type { GenerationStageEvent } from '../../types';
import { buildStageTimeline } from '../../lib/stageTimeline';
import { recipeStageLabel } from '../../lib/recipeStages';
import { ThinkingDots } from '../shared/ThinkingDots';

interface RecipeExtractionTheaterProps {
  stageEvents: GenerationStageEvent[];
  /** True when extracting from a video link (changes the narration). */
  hasVideo: boolean;
}

/**
 * Live narration of the recipe extraction pipeline — the cookbook's own
 * generation theater. Each line is a stage the server actually ran, told in
 * kitchen voice, with a recipe card shimmering into shape underneath.
 */
export function RecipeExtractionTheater({ stageEvents, hasVideo }: RecipeExtractionTheaterProps) {
  const timeline = buildStageTimeline(stageEvents, ev => recipeStageLabel(ev, hasVideo));
  const hasTimeline = timeline.length > 0;

  return (
    <div
      data-testid="recipe-extraction-theater"
      className="rounded-2xl bg-gradient-to-br from-rose-500 via-rose-500 to-orange-500 p-4 text-white shadow-lg shadow-rose-500/20 overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg animate-pulse" aria-hidden="true">🍳</span>
        <span className="text-sm font-bold">Toolie is in the kitchen</span>
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
          {hasVideo ? 'Pulling the recipe out of your video…' : 'Pulling your recipe together…'}
          <ThinkingDots />
        </p>
      )}

      {/* The recipe card taking shape — title and ingredient lines shimmer in */}
      <div className="mt-4 rounded-xl bg-white/10 p-3 flex flex-col gap-2" aria-hidden="true">
        <div className="h-3 w-1/2 rounded-full shimmer-block" />
        {['w-4/5', 'w-3/5', 'w-2/3'].map((width, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
            <div className={`h-2.5 ${width} rounded-full shimmer-block`} style={{ animationDelay: `${i * 0.2}s` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
