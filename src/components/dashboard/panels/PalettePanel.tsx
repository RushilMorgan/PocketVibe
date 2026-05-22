import { Check } from 'lucide-react';
import type { ThemeName } from '../../../types';
import PalettePicker from '../../thumbzone/PalettePicker';

interface PalettePanelProps {
  currentTheme: ThemeName;
  onSelectTheme: (theme: ThemeName) => void;
  onDone: () => void;
}

export default function PalettePanel({ currentTheme, onSelectTheme, onDone }: PalettePanelProps) {
  return (
    <div className="pb-1">
      <div className="flex items-center justify-between px-4 pt-2 mb-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Change Theme
        </p>
        <button
          onClick={onDone}
          className="flex items-center gap-1 text-xs font-bold text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors"
        >
          <Check className="w-3 h-3" />
          Done
        </button>
      </div>
      <PalettePicker currentTheme={currentTheme} onSelect={onSelectTheme} />
    </div>
  );
}
