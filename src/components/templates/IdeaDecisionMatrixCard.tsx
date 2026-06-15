import { useState } from 'react';
import type { IdeaDecisionMatrix } from '../../types';
import { rankOptions } from '../../lib/decisionMatrix';

interface IdeaDecisionMatrixCardProps {
  matrix: IdeaDecisionMatrix;
  frosted?: boolean;
}

function WeightDots({ weight }: { weight: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`weight ${weight} of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={`w-1 h-1 rounded-full ${n <= weight ? 'bg-violet-400' : 'bg-gray-200'}`} />
      ))}
    </span>
  );
}

/**
 * Weighted decision matrix — the standard "criteria × options" comparison,
 * rendered mobile-first: ranked option bars with the winner crowned, each
 * expandable into its per-criterion breakdown. AI-written per board.
 */
export function IdeaDecisionMatrixCard({ matrix, frosted = false }: IdeaDecisionMatrixCardProps) {
  const ranked = rankOptions(matrix);
  const [openId, setOpenId] = useState<string | null>(null);
  const max = ranked[0]?.total || 10;

  return (
    <div data-testid="idea-decision-matrix" className={frosted ? 'tp-card rounded-2xl p-4' : 'bg-white rounded-2xl border border-gray-100 p-4'}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-800">⚖️ The matrix says…</h3>
        <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide">Weighted scores</span>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        Each option scored 1–10 on what matters most. Tap one to see why.
      </p>

      <div className="flex flex-col gap-2">
        {ranked.map((opt, i) => {
          const isWinner = i === 0;
          const open = openId === opt.id;
          return (
            <div key={opt.id} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms`, opacity: 0, animationFillMode: 'forwards' }}>
              <button
                data-testid={`matrix-option-${opt.id}`}
                onClick={() => setOpenId(open ? null : opt.id)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  isWinner ? 'bg-violet-50 border-violet-200' : 'bg-gray-50/60 border-gray-100 active:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base leading-none flex-shrink-0">{isWinner ? '🏆' : opt.emoji ?? '◽'}</span>
                  <span className={`text-sm flex-1 min-w-0 truncate ${isWinner ? 'font-black text-violet-900' : 'font-semibold text-gray-700'}`}>
                    {opt.label}
                  </span>
                  <span className={`text-sm font-black tabular-nums ${isWinner ? 'text-violet-700' : 'text-gray-500'}`}>
                    {opt.total}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white overflow-hidden border border-gray-100">
                  <div
                    className={`h-full rounded-full ${isWinner ? 'bg-violet-500' : 'bg-gray-300'}`}
                    style={{ width: `${(opt.total / max) * 100}%`, animation: 'bar-grow 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
                  />
                </div>

                {open && (
                  <div className="mt-2.5 flex flex-col gap-1.5 animate-fade-in">
                    {opt.perCriterion.map(c => (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500 flex-1 min-w-0 truncate">{c.label}</span>
                        <WeightDots weight={c.weight} />
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                          <div className="h-full rounded-full bg-violet-400" style={{ width: `${c.score * 10}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 w-4 text-right tabular-nums">{c.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-300 mt-2 px-1">
        Dots show how much each factor matters. The numbers are honest, not diplomatic.
      </p>
    </div>
  );
}
