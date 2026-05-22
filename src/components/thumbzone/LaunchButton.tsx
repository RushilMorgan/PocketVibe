import { Rocket } from 'lucide-react';
import type { SiteBuilderAction } from '../../types';

interface LaunchButtonProps {
  dispatch: React.Dispatch<SiteBuilderAction>;
}

export default function LaunchButton({ dispatch }: LaunchButtonProps) {
  return (
    <div className="px-4 pt-3 pb-2 flex flex-col items-center gap-2.5">
      <p className="text-xs text-gray-500 font-medium text-center">
        Looking great! Your site is ready to go live 🎉
      </p>
      <button
        onClick={() => dispatch({ type: 'SHOW_LAUNCH' })}
        className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
          animation: 'pulse-glow 2.2s ease-in-out infinite',
        }}
      >
        <Rocket className="w-5 h-5" />
        🚀 Launch Live Site
      </button>
    </div>
  );
}
