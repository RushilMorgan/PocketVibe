import type { AppView, Creation } from '../types';

interface PVHeaderProps {
  view: AppView;
  activeCreation: Creation | null;
  creationsCount: number;
  accentColor: string;
  onBack: () => void;
  onGoMyCreations: () => void;
  /** Shown when user is logged in — navigates to My Tools page. */
  onGoMyTools?: () => void;
  /** Email of the logged-in user (first letter used as avatar). */
  userEmail?: string;
  /** Shown when user is not logged in and auth is available. */
  onSignIn?: () => void;
}

export default function PVHeader({
  view,
  activeCreation,
  creationsCount,
  accentColor,
  onBack,
  onGoMyCreations,
  onGoMyTools,
  userEmail,
  onSignIn,
}: PVHeaderProps) {
  const showBack = view === 'creation' || view === 'my-creations' || view === 'my-tools';
  const title = view === 'creation' && activeCreation
    ? activeCreation.title
    : view === 'my-creations'
    ? 'My things'
    : view === 'my-tools'
    ? 'My Tools'
    : null;

  return (
    <div
      className="flex items-center gap-3 px-4 shrink-0"
      style={{ height: '52px', borderBottom: '1px solid #f0f0f5' }}
    >
      {/* Back button — min 44×44 touch target per Apple HIG */}
      {showBack ? (
        <button
          onClick={onBack}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-gray-100 active:bg-gray-200 flex-shrink-0"
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : (
        <span
          className="text-sm font-black tracking-tight flex-shrink-0"
          style={{ color: accentColor, transition: 'color 0.3s' }}
        >
          Hey Toolie
        </span>
      )}

      {/* Title / spacer */}
      <div className="flex-1 min-w-0">
        {title && (
          <span className="text-sm font-semibold text-gray-800 truncate block leading-tight">
            {title}
          </span>
        )}
        {view === 'creation' && activeCreation?.version && activeCreation.version > 1 && (
          <span className="text-xs text-gray-400">v{activeCreation.version}</span>
        )}
      </div>

      {/* My things link — hidden on the my-creations and my-tools views */}
      {creationsCount > 0 && view !== 'my-creations' && view !== 'my-tools' && (
        <button
          onClick={onGoMyCreations}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <span className="text-xs font-semibold text-gray-600">My things</span>
          <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
            style={{ background: accentColor }}>
            {creationsCount > 9 ? '9+' : creationsCount}
          </span>
        </button>
      )}

      {/* User avatar (logged in) or Sign in button — hidden on my-tools (already "inside" account) */}
      {view !== 'my-tools' && (userEmail && onGoMyTools ? (
        <button
          onClick={onGoMyTools}
          title={userEmail}
          className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-bold active:opacity-80"
          style={{ background: accentColor }}
        >
          {userEmail[0].toUpperCase()}
        </button>
      ) : onSignIn ? (
        <button
          onClick={onSignIn}
          className="flex-shrink-0 text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-full bg-gray-100 active:bg-gray-200"
        >
          Sign in
        </button>
      ) : null)}
    </div>
  );
}