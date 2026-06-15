import type { IdeaWhyStep } from '../../types';

interface IdeaFiveWhysProps {
  steps: IdeaWhyStep[];
  frosted?: boolean;
}

/**
 * Five Whys — the classic root-cause drill, rendered as a descending chain:
 * the surface problem at the top, each "why?" stepping deeper, the root
 * cause highlighted at the bottom. AI-written per board.
 */
export function IdeaFiveWhys({ steps, frosted = false }: IdeaFiveWhysProps) {
  return (
    <div data-testid="idea-five-whys" className={frosted ? 'tp-card rounded-2xl p-4' : 'bg-white rounded-2xl border border-gray-100 p-4'}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">🔍 Why, really?</h3>
        <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide">Five Whys</span>
      </div>
      <div className="flex flex-col">
        {steps.map((step, i) => {
          const isRoot = i === steps.length - 1;
          return (
            <div key={step.id} className="animate-fade-in" style={{ animationDelay: `${i * 120}ms`, opacity: 0, animationFillMode: 'forwards' }}>
              {i > 0 && (
                <div className="flex items-center gap-1.5 py-1 pl-3" aria-hidden="true">
                  <span className="text-violet-300 text-xs leading-none">↓</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-violet-300">why?</span>
                </div>
              )}
              <div
                className={`rounded-xl px-3 py-2.5 text-[13px] leading-snug ${
                  isRoot
                    ? 'bg-violet-600 text-white font-semibold'
                    : 'bg-gray-50 text-gray-700'
                }`}
                style={{ marginLeft: `${Math.min(i, 4) * 8}px` }}
              >
                {isRoot && (
                  <span className="block text-[9px] font-black uppercase tracking-widest text-violet-200 mb-0.5">
                    Root cause
                  </span>
                )}
                {step.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
