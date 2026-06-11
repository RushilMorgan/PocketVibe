import type { IdeaThinkingBoardContent } from '../../types';
import { buildSwot, iceScore } from '../../lib/ideaFrameworks';

interface IdeaSnapshotProps {
  content: IdeaThinkingBoardContent;
}

const QUADRANTS = [
  { key: 'strengths' as const, label: 'Strengths', emoji: '💪', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-800', empty: 'No standout strengths yet' },
  { key: 'weaknesses' as const, label: 'Weaknesses', emoji: '🧩', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-800', empty: 'No major weak spots' },
  { key: 'opportunities' as const, label: 'Opportunities', emoji: '🌅', bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-800', empty: 'None spotted yet' },
  { key: 'threats' as const, label: 'Threats', emoji: '⛈️', bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-800', empty: 'No threats identified' },
];

/** Ring dial showing the ICE total out of 10. */
function IceDial({ total }: { total: number }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const filled = (total / 10) * circumference;
  const color = total >= 7.5 ? '#059669' : total >= 5.5 ? '#7c3aed' : total >= 3.5 ? '#d97706' : '#dc2626';
  return (
    <div className="relative w-[72px] h-[72px] flex-shrink-0" aria-hidden="true">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
        <circle
          cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black leading-none" style={{ color }}>{total}</span>
        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide">/ 10</span>
      </div>
    </div>
  );
}

function IceBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-gray-500 w-[4.5rem] flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500"
          style={{ width: `${value * 10}%`, animation: 'bar-grow 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </div>
      <span className="text-[10px] font-bold text-gray-600 w-4 text-right tabular-nums">{value}</span>
    </div>
  );
}

/**
 * "At a glance" — the idea through two industry-standard lenses, computed
 * live from the board's own data: an ICE priority score (Impact ×
 * Confidence × Ease) and a SWOT grid. Visual-first: the verdict lands
 * before a single paragraph is read.
 */
export function IdeaSnapshot({ content }: IdeaSnapshotProps) {
  const ice = iceScore(content.scores);
  const swot = buildSwot(content);

  return (
    <div data-testid="idea-snapshot" className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* ICE verdict strip */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-4">
        <IceDial total={ice.total} />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <p className="text-sm font-bold text-gray-900 leading-tight">{ice.verdict}</p>
          <IceBar label="Impact" value={ice.impact} />
          <IceBar label="Confidence" value={ice.confidence} />
          <IceBar label="Ease" value={ice.ease} />
        </div>
      </div>

      {/* SWOT 2×2 */}
      <div className="px-3 pb-3">
        <div className="grid grid-cols-2 gap-1.5">
          {QUADRANTS.map((q, i) => {
            const items = swot[q.key];
            return (
              <div
                key={q.key}
                data-testid={`swot-${q.key}`}
                className={`rounded-xl border p-2.5 ${q.bg} ${q.border} animate-node-pop`}
                style={{ animationDelay: `${150 + i * 90}ms`, opacity: 0, animationFillMode: 'forwards' }}
              >
                <p className={`text-[10px] font-black uppercase tracking-wide mb-1 ${q.text}`}>
                  {q.emoji} {q.label}
                </p>
                {items.length === 0 ? (
                  <p className="text-[11px] text-gray-400 leading-snug">{q.empty}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {items.map((item, j) => (
                      <li key={j} className="text-[11px] text-gray-700 leading-snug flex gap-1">
                        <span className={`${q.text} flex-shrink-0`}>•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-300 mt-2 px-1">
          SWOT + ICE — standard thinking tools, read live from your board.
        </p>
      </div>
    </div>
  );
}
