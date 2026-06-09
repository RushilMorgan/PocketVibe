import React, { useState, useEffect, useRef } from 'react';
import AppShell from './components/AppShell';
import PVHeader from './components/PVHeader';
import { HomeScreen } from './components/HomeScreen';
import { MyThingsPage } from './components/MyThingsPage';
import { CreationComposer } from './components/CreationComposer';
import { TemplateRenderer } from './components/templates/TemplateRenderer';
import { SharePanel } from './components/SharePanel';
import { AuthModal } from './components/AuthModal';
import { IdeaIntakeSheet } from './components/IdeaIntakeSheet';
import { RecipeIntakeSheet } from './components/RecipeIntakeSheet';
import { UserProfilePage } from './components/UserProfilePage';
import { usePocketVibe } from './hooks/usePocketVibe';
import { useAuth } from './hooks/useAuth';
import type { AuthModalVariant } from './components/AuthModal';
import { formatCreationSummary } from './lib/creationSummary';
import { formatResetHint } from './lib/quotaMessage';
import {
  identifyUser,
  resetUser,
  trackSharePanelOpened,
  trackShareLinkCreated,
  trackSignIn,
  trackSignOut,
  trackWorldCupPoolCreated,
} from './lib/analytics';

export default function App() {
  const auth = useAuth();

  const {
    state,
    activeCreation,
    openCreation,
    goHome,
    goToMyCreations,
    signOutReset,
    startNewCreation,
    improveCreation,
    chatMessage,
    confirmNewCreation,
    dismissPendingAction,
    deleteCreation,
    duplicateCreation,
    renameCreation,
    updateCreationContent,
    setCreationShareSlug,
    createWorldCupPool,
    createIdeaBoard,
    createRecipeBook,
    extractRecipe,
    chatAboutRecipe,
    quotaNotice,
    dismissQuotaNotice,
    goToMyProfile,
  } = usePocketVibe(auth.user?.id);

  // ── Back-button / popstate handling ─────────────────────────────────────────
  // We always keep one history entry ahead of the current page so Android's
  // hardware back and iOS swipe-back get intercepted before leaving the app.
  const backHandlerRef = useRef<() => void>(() => {});

  // Keep the ref up-to-date with current view/modal state (no dep-lint issue
  // because we intentionally capture everything as a snapshot each render).
  useEffect(() => {
    backHandlerRef.current = () => {
      // Close modals/sheets first, then navigate views
      if (sharePanelOpen)   { setSharePanelOpen(false); return; }
      if (authModalOpen)    { setAuthModalOpen(false);  return; }
      if (view === 'my-creations') {
        activeCreation ? openCreation(activeCreation.id) : goHome();
      } else if (view !== 'home') {
        goHome();
      }
    };
  });

  // Push an initial entry so the very first back press is interceptable.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.pushState({ pv: true }, '');
    const handler = () => {
      backHandlerRef.current();
      // Re-push so subsequent back presses are also intercepted.
      window.history.pushState({ pv: true }, '');
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalVariant, setAuthModalVariant] = useState<AuthModalVariant>('account');
  const [saveNudgeDismissed, setSaveNudgeDismissed] = useState(
    () => Boolean(localStorage.getItem('pv_save_nudge_dismissed'))
  );
  const [pendingToolAction, setPendingToolAction] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [ideaIntakeOpen, setIdeaIntakeOpen] = useState(false);
  const [recipeIntakeOpen, setRecipeIntakeOpen] = useState(false);

  const { view, creations, activeCreationId, isGenerating, processingStatus, pendingAction, messages, accentColor } = state;

  /**
   * Sign out: clear the Supabase session, strip owned creations from the local
   * store (keeping any anonymous ones), and navigate home so the user doesn't
   * land on a now-empty My things screen.
   */
  async function handleSignOut() {
    const signedOutUserId = auth.user?.id;
    trackSignOut();
    resetUser();
    await auth.signOut();
    if (signedOutUserId) {
      signOutReset(signedOutUserId);
    } else {
      goHome();
    }
  }

  function openAuthModal(variant: AuthModalVariant) {
    setAuthModalVariant(variant);
    setAuthModalOpen(true);
  }

  function dismissSaveNudge() {
    setSaveNudgeDismissed(true);
    localStorage.setItem('pv_save_nudge_dismissed', '1');
  }

  async function handleNativeShare() {
    if (!activeCreation) return;
    const text = formatCreationSummary(activeCreation);
    if (navigator.share) {
      try {
        await navigator.share({ title: activeCreation.title, text });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    await handleCopyText();
  }

  async function handleCopyText() {
    if (!activeCreation) return;
    const text = formatCreationSummary(activeCreation);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  }

  /** Whether to show the save nudge banner. */
  const showSaveNudge =
    auth.isAvailable &&
    !auth.user &&
    !auth.loading &&
    creations.length >= 1 &&
    !saveNudgeDismissed &&
    !isGenerating &&
    view !== 'my-creations';

  return (
    <AppShell>
      {/* Header */}
      <PVHeader
        view={view}
        activeCreation={activeCreation}
        creationsCount={creations.length}
        accentColor={accentColor}
        onBack={
          // "Back" is context-aware: my-creations goes back to the active
          // creation if one exists, everything else goes home.
          view === 'my-creations' && activeCreation
            ? () => openCreation(activeCreation.id)
            : goHome
        }
        onGoMyCreations={goToMyCreations}
        onGoAccount={auth.user ? goToMyCreations : undefined}
        userEmail={auth.user?.email}
        onSignIn={auth.isAvailable && !auth.user ? () => openAuthModal('account') : undefined}
        onShare={
          view === 'creation' && activeCreation?.status === 'ready' && !isGenerating
            ? () => { setSharePanelOpen(true); trackSharePanelOpened(activeCreation.creationType); }
            : undefined
        }
      />

      {/* Save nudge banner */}
      {showSaveNudge && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
          <span className="text-xs text-amber-800 flex-1">
            💾 <strong>Save this so you don't lose it</strong> — create a free account.
          </span>
          <button
            onClick={() => openAuthModal('save')}
            className="text-xs font-semibold text-amber-700 px-3 py-1 rounded-lg bg-amber-100 active:bg-amber-200 flex-shrink-0"
          >
            Save
          </button>
          <button
            onClick={dismissSaveNudge}
            className="text-amber-400 hover:text-amber-600 text-sm leading-none flex-shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden relative">
        {view === 'home' && (
          <HomeScreen
            onPrompt={startNewCreation}
            isGenerating={isGenerating}
            onCreateWorldCupPool={createWorldCupPool}
            onSignIn={auth.isAvailable && !auth.user && !auth.loading ? () => openAuthModal('account') : undefined}
            onOpenChat={() => setComposerOpen(true)}
            onOpenIdeaBoard={() => setIdeaIntakeOpen(true)}
            onOpenRecipe={() => setRecipeIntakeOpen(true)}
          />
        )}

        {view === 'creation' && (
          <div className="flex flex-col h-full overflow-hidden relative">
            {/* Remix source banner — links back to the shared pool this was copied from */}
            {activeCreation?.remixSourceUrl && (
              <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-slate-900 rounded-xl flex-shrink-0">
                <span className="text-yellow-400 text-xs">🏆</span>
                <p className="text-xs text-white/60 flex-1 truncate">
                  Your copy — <span className="text-white/80 font-semibold">original pool still live</span>
                </p>
                <a
                  href={activeCreation.remixSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-black text-yellow-400 flex-shrink-0 active:opacity-70"
                >
                  View original →
                </a>
              </div>
            )}

            {/* Summary banner — only for new creations (version 1).
                For improve/add flows the verified outcome is in the messages thread. */}
            {activeCreation?.status === 'ready' && activeCreation.summary &&
              messages.length > 0 && activeCreation.version === 1 && (
              <div className="mx-4 mt-3 px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-600 leading-relaxed flex-shrink-0">
                {activeCreation.summary}
              </div>
            )}

            {/* Share button moved to PVHeader — no longer needs a strip here */}

            {/* Generating overlay */}
            {isGenerating && (
              <div className="flex-shrink-0 mx-4 mt-3 px-4 py-3 rounded-xl bg-violet-50 flex items-center gap-2">
                <span className="text-base animate-pulse">✨</span>
                <span className="text-sm text-violet-700 font-medium">
                  {processingStatus ?? 'Making something for you…'}
                </span>
              </div>
            )}

            {/* Canvas */}
            {activeCreation && activeCreation.status !== 'generating' ? (
              <div className="flex-1 overflow-y-auto pb-24">
                <TemplateRenderer
                  creation={activeCreation}
                  onContentChange={updateCreationContent}
                  onShare={() => setSharePanelOpen(true)}
                  pendingLocalAction={pendingToolAction}
                  onLocalActionConsumed={() => setPendingToolAction(null)}
                  onExtractRecipe={extractRecipe}
                  onRecipeChat={chatAboutRecipe}
                />
              </div>
            ) : !isGenerating && (
              <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
                Nothing to show yet
              </div>
            )}

            {/* Error state */}
            {activeCreation?.status === 'error' && (
              <div className="mx-4 mb-4 px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600 flex-shrink-0">
                Something went wrong. Tap ✨ below and try again.
              </div>
            )}
          </div>
        )}

        {/* Toolie FAB + sheet — shown on home and creation views */}
        {(view === 'home' || view === 'creation') && (
          <CreationComposer
            activeCreation={view === 'home' ? null : activeCreation}
            messages={view === 'home' ? [] : messages}
            isGenerating={isGenerating}
            processingStatus={processingStatus}
            onNew={startNewCreation}
            onImprove={(req) => improveCreation(req, 'improve')}
            onAdd={(req) => improveCreation(req, 'add')}
            open={composerOpen}
            onOpenChange={setComposerOpen}
            onChat={chatMessage}
            onToolAction={setPendingToolAction}
            isSignedIn={Boolean(auth.user)}
            onRequestSignIn={
              auth.isAvailable && !auth.user ? () => openAuthModal('account') : undefined
            }
          />
        )}

        {view === 'my-creations' && (
          <MyThingsPage
            creations={creations}
            activeCreationId={activeCreationId}
            user={auth.user}
            onOpen={openCreation}
            onDelete={deleteCreation}
            onDuplicate={duplicateCreation}
            onRename={renameCreation}
            onSignOut={handleSignOut}
            onGoHome={goHome}
            onGoMyProfile={auth.user ? goToMyProfile : undefined}
          />
        )}

        {view === 'my-profile' && auth.user && (
          <UserProfilePage
            userId={auth.user.id}
            onBack={goToMyCreations}
          />
        )}
      </div>

      {/* New-creation guard dialog */}
      {pendingAction?.type === 'new-creation' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismissPendingAction} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full">
            <h3 className="font-bold text-gray-900 text-base mb-2">Start something new?</h3>
            <p className="text-sm text-gray-500 mb-5">
              You have "{activeCreation?.title}" open. It's already saved — starting fresh won't delete it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={dismissPendingAction}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50"
              >
                Keep it
              </button>
              <button
                onClick={confirmNewCreation}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700"
              >
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share panel */}
      {sharePanelOpen && activeCreation && (
        <SharePanel
          creation={activeCreation}
          onClose={() => setSharePanelOpen(false)}
          onCreationShared={(slug) => {
            if (activeCreation) setCreationShareSlug(activeCreation.id, slug);
          }}
          isLoggedIn={Boolean(auth.user)}
          onRequestAuth={auth.isAvailable ? () => {
            setSharePanelOpen(false);
            openAuthModal('share');
          } : undefined}
        />
      )}

      {/* Auth modal */}
      {authModalOpen && (
        <AuthModal
          variant={authModalVariant}
          auth={auth}
          onSuccess={() => {
            setAuthModalOpen(false);
            dismissSaveNudge();
            // Identify the newly signed-in user in PostHog
            if (auth.user) identifyUser(auth.user.id, auth.user.email);
            if (authModalVariant === 'share') {
              // Signed in during share flow → go straight back to share panel
              setSharePanelOpen(true);
            } else if (authModalVariant === 'account' || authModalVariant === 'claim') {
              goToMyCreations();
            }
          }}
          // No onSkip for the share variant — auth is now required to share
          onClose={() => setAuthModalOpen(false)}
        />
      )}

      {/* Idea Board intake */}
      <IdeaIntakeSheet
        open={ideaIntakeOpen}
        onClose={() => setIdeaIntakeOpen(false)}
        onSubmit={(categoryLabel, idea, intentId) => {
          setIdeaIntakeOpen(false);
          createIdeaBoard(categoryLabel, idea, intentId);
        }}
      />

      {/* Recipe intake */}
      <RecipeIntakeSheet
        open={recipeIntakeOpen}
        onClose={() => setRecipeIntakeOpen(false)}
        onSubmit={(input) => {
          setRecipeIntakeOpen(false);
          createRecipeBook(input);
        }}
      />

      {/* Daily-limit notice — visible, distinct from real errors */}
      {quotaNotice && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismissQuotaNotice} />
          <div data-testid="quota-notice-modal" className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full text-center">
            <div className="text-4xl mb-2">⏳</div>
            <h3 className="font-bold text-gray-900 text-base mb-1">
              {quotaNotice.kind === 'chat'
                ? "That's all your questions for today"
                : "That's all your creations for today"}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Resets {formatResetHint(quotaNotice.resetsAt)}.
              {quotaNotice.tier === 'anonymous' && ' Sign in for a higher daily limit.'}
            </p>
            {quotaNotice.tier === 'anonymous' && auth.isAvailable && !auth.user ? (
              <div className="flex flex-col gap-2">
                <button
                  data-testid="quota-notice-signin"
                  onClick={() => { dismissQuotaNotice(); openAuthModal('account'); }}
                  className="w-full py-3 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-700"
                >
                  Sign in for more
                </button>
                <button
                  onClick={dismissQuotaNotice}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-500 active:bg-gray-50"
                >
                  Maybe later
                </button>
              </div>
            ) : (
              <button
                onClick={dismissQuotaNotice}
                className="w-full py-3 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-700"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
