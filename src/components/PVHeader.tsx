import type { BlueprintId } from '../types';

interface PVHeaderProps {
  simulatePartner: boolean;
  currentBlueprint: BlueprintId;
  onToggleSimulate: () => void;
  onSwapBlueprint: (id: BlueprintId) => void;
}

export default function PVHeader({
  simulatePartner,
  currentBlueprint,
  onToggleSimulate,
  onSwapBlueprint,
}: PVHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-3 shrink-0"
      style={{ flex: '0 0 7%', borderBottom: '1px solid #f0f0f5' }}
    >
      {/* Wordmark */}
      <span
        className="text-sm font-black tracking-tight"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #f43f5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
      >
        PocketVibe
      </span>

      {/* Blueprint switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => onSwapBlueprint('grocery')}
          className="text-[10px] font-bold px-2.5 py-1 rounded-md transition-all"
          style={{
            backgroundColor: currentBlueprint === 'grocery' ? '#7c3aed' : 'transparent',
            color: currentBlueprint === 'grocery' ? '#fff' : '#6b7280',
          }}
        >
          🛒 Grocery
        </button>
        <button
          onClick={() => onSwapBlueprint('chore')}
          className="text-[10px] font-bold px-2.5 py-1 rounded-md transition-all"
          style={{
            backgroundColor: currentBlueprint === 'chore' ? '#7c3aed' : 'transparent',
            color: currentBlueprint === 'chore' ? '#fff' : '#6b7280',
          }}
        >
          🎰 Chores
        </button>
      </div>

      {/* Simulate toggle */}
      <button
        onClick={onToggleSimulate}
        className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all active:scale-95"
        style={{
          backgroundColor: simulatePartner ? '#dcfce7' : '#f3f4f6',
          color: simulatePartner ? '#16a34a' : '#9ca3af',
          animation: simulatePartner ? 'pulse-glow 2s ease-in-out infinite' : 'none',
        }}
      >
        {simulatePartner ? '⚡ Live' : '👥 Sim'}
      </button>
    </div>
  );
}
