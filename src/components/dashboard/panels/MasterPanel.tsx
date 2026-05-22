import { Plus, MousePointerClick } from 'lucide-react';

interface MasterPanelProps {
  onAddSection: () => void;
}

export default function MasterPanel({ onAddSection }: MasterPanelProps) {
  return (
    <div className="px-4 pt-2 pb-3">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
        Editor Controls
      </p>

      {/* Hint card */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 mb-3">
        <MousePointerClick className="w-4 h-4 text-violet-500 shrink-0" />
        <p className="text-xs text-violet-700 leading-snug">
          Tap your <span className="font-bold">headline</span> or{' '}
          <span className="font-bold">subheadline</span> to edit.
          Tap the <span className="font-bold">background</span> to change the theme.
        </p>
      </div>

      {/* Add Section button */}
      <button
        onClick={onAddSection}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-violet-700 border-2 border-dashed border-violet-300 hover:bg-violet-50 active:scale-[0.97] transition-all"
      >
        <Plus className="w-4 h-4" />
        Add New Section
      </button>
    </div>
  );
}
