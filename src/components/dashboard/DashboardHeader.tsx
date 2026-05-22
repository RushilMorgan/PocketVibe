import { Globe, Loader2, Save } from 'lucide-react';

interface DashboardHeaderProps {
  subdomain: string;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
}

export default function DashboardHeader({
  subdomain,
  isDirty,
  isSaving,
  onSave,
}: DashboardHeaderProps) {
  const canSave = isDirty && !isSaving;

  return (
    <div
      className="flex items-center justify-between px-4 bg-white border-b border-gray-100 shrink-0 z-10"
      style={{ flex: '0 0 7%' }}
    >
      {/* Subdomain label */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-3">
        <Globe className="w-4 h-4 text-violet-500 shrink-0" />
        <span className="text-[11px] font-semibold text-gray-500 truncate">{subdomain}</span>
        {isDirty && (
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />
        )}
      </div>

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={!canSave}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full transition-all shrink-0 ${
          canSave
            ? 'bg-violet-600 text-white shadow-sm hover:bg-violet-700 active:scale-95'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isSaving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        {isSaving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
