import type { ThemeName, SiteBuilderAction } from '../../types';

interface PalettePickerProps {
  currentTheme: ThemeName;
  dispatch?: React.Dispatch<SiteBuilderAction>;
  onSelect?: (theme: ThemeName) => void;
}

const PALETTES: {
  id: ThemeName;
  emoji: string;
  label: string;
  swatches: string[];
}[] = [
  {
    id: 'soft-pink',
    emoji: '🌸',
    label: 'Soft Pink',
    swatches: ['#fff0f3', '#f43f5e', '#fb7185'],
  },
  {
    id: 'sage-green',
    emoji: '🌿',
    label: 'Sage Green',
    swatches: ['#f0fdf4', '#16a34a', '#4ade80'],
  },
  {
    id: 'ocean-blue',
    emoji: '🌊',
    label: 'Ocean Blue',
    swatches: ['#eff6ff', '#1e3a5f', '#3b82f6'],
  },
];

export default function PalettePicker({ currentTheme, dispatch, onSelect }: PalettePickerProps) {
  return (
    <div className="px-4 pt-3 pb-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
        Choose your vibe
      </p>
      <div className="flex gap-2.5">
        {PALETTES.map((p) => {
          const selected = currentTheme === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                if (onSelect) {
                  onSelect(p.id);
                } else if (dispatch) {
                  dispatch({ type: 'SELECT_PALETTE', payload: p.id });
                }
              }}
              className="flex-1 flex flex-col items-center gap-2 py-3 px-2 rounded-2xl transition-all active:scale-95"
              style={{
                border: selected ? '2px solid #7c3aed' : '2px solid #e5e7eb',
                background: selected ? '#f5f3ff' : '#fafafa',
                boxShadow: selected ? '0 4px 14px rgba(124,58,237,0.18)' : 'none',
              }}
            >
              {/* Color swatches */}
              <div className="flex gap-1">
                {p.swatches.map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full"
                    style={{
                      backgroundColor: color,
                      border: '1.5px solid rgba(0,0,0,0.07)',
                    }}
                  />
                ))}
              </div>
              <span className="text-xl leading-none">{p.emoji}</span>
              <span
                className="text-[11px] font-bold leading-tight"
                style={{ color: selected ? '#7c3aed' : '#374151' }}
              >
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
