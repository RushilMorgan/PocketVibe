import type { AppView, Creation } from '../types';

interface PVHeaderProps {
  view: AppView;
  activeCreation: Creation | null;
  creationsCount: number;
  accentColor: string;
  onBack: () => void;
  onGoMyCreations: () => void;
  /** Shown when user is logged in — avatar navigates to the My things page. */
  onGoAccount?: () => void;
  /** Email of the logged-in user (first letter used as avatar). */
  userEmail?: string;
  /** Shown when user is not logged in and auth is available. */
  onSignIn?: () => void;
  /** Opens the share panel from the header in creation view. */
  onShare?: () => void;
}

/**
 * Velix top bar — light/frosted, near-black ink, frosted pill controls. The ✦
 * wordmark on home; a frosted back button + title on sub-views. Uses the shared
 * .tp-* layer (index.css) so it matches the rest of the redesigned app.
 */
export default function PVHeader({
  view,
  activeCreation,
  creationsCount,
  accentColor,
  onBack,
  onGoMyCreations,
  onGoAccount,
  userEmail,
  onSignIn,
  onShare,
}: PVHeaderProps) {
  const showBack = view === 'creation' || view === 'my-creations';
  const title = view === 'creation' && activeCreation
    ? activeCreation.title
    : view === 'my-creations'
    ? 'My things'
    : null;

  return (
    <div
      className="flex items-center gap-2.5 px-4 shrink-0 bg-white/80 border-b border-black/5"
      style={{ height: '56px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* Back button — min 44 touch target per Apple HIG */}
      {showBack ? (
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full tp-glass flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16150f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-sm tp-ink">✦</span>
          <span className="text-base font-extrabold tracking-tight tp-ink">Hey Toolie</span>
        </div>
      )}

      {/* Title / spacer */}
      <div className="flex-1 min-w-0">
        {title && (
          <span className="text-sm font-bold tp-ink truncate block leading-tight">
            {title}
          </span>
        )}
        {view === 'creation' && activeCreation?.version && activeCreation.version > 1 && (
          <span className="text-xs tp-ink-3">v{activeCreation.version}</span>
        )}
      </div>

      {/* Share button — creation view only */}
      {view === 'creation' && onShare && (
        <button
          data-testid="share-creation-btn"
          onClick={onShare}
          className="flex-shrink-0 w-9 h-9 rounded-full tp-glass flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Share"
          title="Share"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16150f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      )}

      {/* My things — hidden on the my-creations view (you're already there) */}
      {(creationsCount > 0 || Boolean(userEmail)) && view !== 'my-creations' && (
        <button
          onClick={onGoMyCreations}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full tp-glass active:scale-95 transition-transform"
        >
          <span className="text-xs font-semibold tp-ink">My things</span>
          {creationsCount > 0 && (
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: '#16150f' }}>
              {creationsCount > 9 ? '9+' : creationsCount}
            </span>
          )}
        </button>
      )}

      {/* User avatar (logged in) or Sign in */}
      {view !== 'my-creations' && (userEmail && onGoAccount ? (
        <button
          onClick={onGoAccount}
          title={userEmail}
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold active:opacity-80 ring-2 ring-white"
          style={{ background: `linear-gradient(135deg, ${accentColor}, #6366f1)`, boxShadow: '0 4px 12px rgba(22,21,15,0.12)' }}
        >
          {userEmail[0].toUpperCase()}
        </button>
      ) : onSignIn ? (
        <button
          onClick={onSignIn}
          className="flex-shrink-0 text-xs font-semibold tp-ink px-3.5 py-1.5 rounded-full tp-glass active:scale-95 transition-transform"
        >
          Sign in
        </button>
      ) : null)}
    </div>
  );
}
