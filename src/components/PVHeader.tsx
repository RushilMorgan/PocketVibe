interface PVHeaderProps {
  simulatePartner: boolean;
  currentColor: string;
  onToggleSimulate: () => void;
  onLoadPreset: (preset: 'grocery' | 'blank') => void;
}

export default function PVHeader({
  simulatePartner,
  currentColor,
  onToggleSimulate,
  onLoadPreset,
}: PVHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-3 shrink-0"
      style={{ flex: '0 0 7%', borderBottom: '1px solid #f0f0f5' }}
    >
      <span
        className="text-sm font-black tracking-tight"
        style={{ color: currentColor, transition: 'color 0.3s' }}
      >
        PocketVibe AI
      </span>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => onLoadPreset('grocery')}
          className="text-[10px] font-bold px-2 py-1 rounded-md transition-all text-gray-600 hover:bg-white"
        >
          Preset: Grocery
        </button>
        <button
          onClick={() => onLoadPreset('blank')}
          className="text-[10px] font-bold px-2 py-1 rounded-md transition-all text-gray-600 hover:bg-white"
        >
          Preset: Blank
        </button>
      </div>

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