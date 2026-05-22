import { Monitor, Globe } from 'lucide-react';

interface AppHeaderProps {
  isPublished: boolean;
  onPublish?: () => void;
}

export default function AppHeader({ isPublished, onPublish }: AppHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-4 bg-white border-b border-gray-100 shrink-0 z-10"
      style={{ flex: '0 0 7%' }}
    >
      {/* Wordmark */}
      <div className="flex items-center gap-1.5">
        <Globe className="w-5 h-5 text-violet-500" />
        <span
          className="text-[17px] font-bold tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          EverySite
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Desktop preview"
          aria-label="Desktop preview"
        >
          <Monitor className="w-4 h-4" />
        </button>

        <button
          onClick={onPublish}
          disabled={!isPublished}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
            isPublished
              ? 'bg-violet-600 text-white shadow-sm hover:bg-violet-700 active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Publish
        </button>
      </div>
    </div>
  );
}
