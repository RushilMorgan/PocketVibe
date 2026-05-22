import type { ChoreItem } from '../../types';

interface ChoreRouletteProps {
  choreItems: ChoreItem[];
  simulatePartner: boolean;
  shimmeringBlockId: string | null;
  accentColor: string;
  styleSlider: number;
  onSpin: () => void;
}

export default function ChoreRoulette({
  choreItems,
  simulatePartner,
  shimmeringBlockId,
  accentColor,
  styleSlider,
  onSpin,
}: ChoreRouletteProps) {
  const isMinimal = styleSlider > 60;
  const isPlayful = styleSlider < 40;
  const cardRadius = Math.round(20 - (styleSlider / 100) * 16);
  const isSpinShimmering = shimmeringBlockId === 'chore-spin';
  const allAssigned = choreItems.every((c) => c.assignee !== null);

  return (
    <div
      className="flex flex-col h-full overflow-y-auto canvas-scroll"
      style={{ backgroundColor: isMinimal ? '#fff' : `${accentColor}08` }}
    >
      {/* Spin zone */}
      <div
        id="chore-spin"
        className={`relative mx-4 mt-4 mb-3 text-center p-4 ${isSpinShimmering ? 'overflow-hidden' : ''}`}
        style={{
          backgroundColor: isMinimal ? '#f9fafb' : `${accentColor}12`,
          borderRadius: `${Math.max(cardRadius, 16)}px`,
          border: isMinimal ? '1px solid #e5e7eb' : 'none',
        }}
      >
        {isSpinShimmering && (
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              borderRadius: `${Math.max(cardRadius, 16)}px`,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer-sweep 1s ease-in-out both',
            }}
          />
        )}

        {simulatePartner && (
          <div className="flex justify-center mb-2">
            <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-sm">
              ⚡ Emily is typing...
            </span>
          </div>
        )}

        <p className="text-3xl mb-1 leading-none">{isPlayful ? '🎰' : '🔀'}</p>
        <p className="text-sm font-black mb-1" style={{ color: accentColor }}>
          Chore Roulette
        </p>
        <p className="text-[11px] text-gray-400 mb-3">
          {allAssigned ? 'Everyone has a chore! Spin again to reassign.' : 'Spin to randomly assign chores to the household.'}
        </p>
        <button
          onClick={onSpin}
          className="px-6 py-2.5 rounded-full font-bold text-sm text-white active:scale-95 transition-transform"
          style={{
            backgroundColor: accentColor,
            boxShadow: isMinimal ? 'none' : `0 4px 16px ${accentColor}44`,
          }}
        >
          🎰 Spin the Roulette!
        </button>
      </div>

      {/* Chore list */}
      <div className="px-4 pb-4">
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-2"
          style={{ color: accentColor }}
        >
          {allAssigned ? 'Assignments' : 'Chores'}
        </p>
        <div className="flex flex-col gap-2">
          {choreItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3"
              style={{
                backgroundColor: '#fff',
                borderRadius: `${cardRadius}px`,
                boxShadow: isMinimal ? '0 1px 3px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.06)',
                border: isMinimal ? '1px solid #f3f4f6' : 'none',
              }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg leading-none">{item.emoji}</span>
                <span className="text-sm font-medium text-gray-800">{item.name}</span>
              </div>
              {item.assignee ? (
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white shrink-0"
                  style={{ backgroundColor: accentColor }}
                >
                  {item.assignee}
                </span>
              ) : (
                <span className="text-[11px] text-gray-400 px-2.5 py-1 rounded-full bg-gray-100 shrink-0">
                  Unassigned
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
