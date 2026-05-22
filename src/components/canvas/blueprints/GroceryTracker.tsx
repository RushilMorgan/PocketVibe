import type { GroceryItem } from '../../types';

interface GroceryTrackerProps {
  groceryItems: GroceryItem[];
  simulatePartner: boolean;
  shimmeringBlockId: string | null;
  accentColor: string;
  styleSlider: number;
  onCycleStatus: (id: string) => void;
}

const STATUS_CONFIG = {
  stocked: { label: 'Stocked', color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a' },
  low:     { label: 'Running Low', color: '#d97706', bg: '#fffbeb', dot: '#d97706' },
  out:     { label: 'Out of Stock', color: '#dc2626', bg: '#fef2f2', dot: '#dc2626' },
};

export default function GroceryTracker({
  groceryItems,
  simulatePartner,
  shimmeringBlockId,
  accentColor,
  styleSlider,
  onCycleStatus,
}: GroceryTrackerProps) {
  const isMinimal = styleSlider > 60;
  const isPlayful = styleSlider < 40;
  const cardRadius = Math.round(24 - (styleSlider / 100) * 20);
  const isShimmering = shimmeringBlockId === 'grocery-grid';

  return (
    <div
      className="flex flex-col h-full overflow-y-auto canvas-scroll pb-4"
      style={{ backgroundColor: isMinimal ? '#fff' : `${accentColor}08` }}
    >
      {/* Canvas header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-gray-800">
            {isPlayful ? '🛒 Grocery Tracker' : 'Grocery Tracker'}
          </h2>
          <p className="text-[10px] text-gray-400 mt-0.5">Tap a card to update status</p>
        </div>
        <div
          className="text-[10px] font-bold px-2 py-1 rounded-full"
          style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
        >
          {groceryItems.length} items
        </div>
      </div>

      {/* Product grid with shimmer overlay */}
      <div
        id="grocery-grid"
        className={`relative px-4 ${isShimmering ? 'overflow-hidden rounded-2xl' : ''}`}
      >
        {isShimmering && (
          <div
            className="absolute inset-0 z-10 pointer-events-none rounded-2xl"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer-sweep 1s ease-in-out both',
            }}
          />
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {groceryItems.map((item, index) => {
            const sc = STATUS_CONFIG[item.status];
            return (
              <div key={item.id} className="relative">
                {/* Partner presence badge */}
                {simulatePartner && index === 0 && (
                  <div className="absolute -top-2.5 left-2 z-20 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-sm pointer-events-none">
                    ⚡ Emily is editing...
                  </div>
                )}

                <button
                  onClick={() => onCycleStatus(item.id)}
                  className="w-full text-left active:scale-[0.96] transition-transform"
                  style={{
                    padding: '10px 12px',
                    backgroundColor: isMinimal ? '#fff' : sc.bg,
                    borderRadius: `${cardRadius}px`,
                    border: isMinimal ? '1px solid #e5e7eb' : 'none',
                    boxShadow: isMinimal ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
                    marginTop: simulatePartner && index === 0 ? '8px' : '0',
                  }}
                >
                  {isPlayful && (
                    <div className="text-2xl mb-1.5 leading-none">{item.emoji}</div>
                  )}
                  {!isPlayful && (
                    <div className="text-lg mb-1 leading-none">{item.emoji}</div>
                  )}
                  <p className="text-xs font-bold text-gray-800 truncate leading-tight">{item.name}</p>
                  <div
                    className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: isMinimal ? '#f3f4f6' : `${sc.color}18`,
                      color: isMinimal ? '#6b7280' : sc.color,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: sc.dot }}
                    />
                    {sc.label}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
