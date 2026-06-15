import React, { useEffect, useState, useCallback } from 'react';
import { trackSharedPageViewed, trackRemixClicked } from '../lib/analytics';
import type {
  AccessMode,
  SharedCreationData,
  CreationContent,
  WorkoutTrackerContent,
  TournamentPoolTrackerContent,
  RecipeContent,
  ChangeRequest,
  Creation,
  CreationType,
} from '../types';
import {
  getSharedCreation,
  updateSharedCreation,
  updateOwnedCreationContent,
  getStoredAdminToken,
  applyCreationAction,
} from '../services/shareService';
import {
  loadCreations,
  saveCreations,
  saveActiveCreationId,
} from '../lib/creationStore';
import { remixContent } from '../lib/remixContent';
import { TemplateRenderer } from './templates/TemplateRenderer';
import { PartnerChallengeParticipantView } from './shared/PartnerChallengeParticipantView';
import { TournamentPoolReadView } from './shared/TournamentPoolReadView';
import { WorkoutTrackerReadView } from './shared/WorkoutTrackerReadView';
import { RecipeReadView } from './shared/RecipeReadView';

interface SharedToolPageProps {
  shareSlug: string;
  adminToken?: string;
  participantToken?: string;
}

type LoadPhase = 'loading' | 'ready' | 'error';

export function SharedToolPage({ shareSlug, adminToken, participantToken }: SharedToolPageProps) {
  const [phase, setPhase] = useState<LoadPhase>('loading');
  const [creation, setCreation] = useState<SharedCreationData | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>('viewer');
  const [participantRef, setParticipantRef] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');

  // Prefer stored admin token from localStorage over URL param
  const resolvedAdminToken = adminToken ?? getStoredAdminToken(shareSlug);
  const token = resolvedAdminToken ?? participantToken;

  // ── Strip sensitive tokens from URL after reading them ─────────────────────
  // Tokens in the query string leak via the Referer header when a user clicks
  // any external link from the admin/participant view. Remove them from the
  // visible URL immediately (they're already saved to localStorage).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('admin') || params.has('p')) {
      params.delete('admin');
      params.delete('p');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []); // runs once on mount, tokens already captured in props

  const load = useCallback(async () => {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const resp = await getSharedCreation(shareSlug, token);
      setCreation(resp.creation);
      setAccessMode(resp.accessMode);
      setParticipantRef(resp.participantRef);
      setPhase('ready');
      trackSharedPageViewed(resp.creation.creationType, resp.accessMode);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not load this tool.');
      setPhase('error');
    }
  }, [shareSlug, token]);

  // Silent background refresh — no loading flash, just quietly updates data.
  const silentRefresh = useCallback(async () => {
    try {
      const resp = await getSharedCreation(shareSlug, token);
      setCreation(resp.creation);
    } catch {
      // Ignore transient errors during background poll
    }
  }, [shareSlug, token]);

  useEffect(() => { load(); }, [load]);

  // Poll every 30 seconds so viewers see new results without manually refreshing.
  useEffect(() => {
    const id = setInterval(silentRefresh, 30_000);
    return () => clearInterval(id);
  }, [silentRefresh]);

  const handleChange = useCallback(async (updatedContent: CreationContent) => {
    if (!creation) return;
    if (accessMode === 'viewer') return;

    const activeToken = resolvedAdminToken ?? participantToken;
    // Admins may save without a stored token: a signed-in owner is authorised by
    // their login (RLS owner_can_update_own). Participants still need their token.
    if (!activeToken && accessMode !== 'admin') return;

    setSaveStatus('saving');
    try {
      if (activeToken) {
        // Admin (with token) or participant → go through the edge function.
        const result = await updateSharedCreation(shareSlug, activeToken, updatedContent, creation.version);
        setCreation(prev => prev ? { ...prev, content: result.content as CreationContent, version: result.version } : prev);
      } else {
        // Signed-in owner, no token on this device → write directly (RLS-gated).
        const result = await updateOwnedCreationContent(shareSlug, updatedContent, creation.version);
        if (!result) { setSaveStatus('conflict'); return; }
        setCreation(prev => prev ? { ...prev, content: result.content, version: result.version } : prev);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Version conflict')) {
        setSaveStatus('conflict');
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
      }
    }
  }, [creation, accessMode, resolvedAdminToken, participantToken, shareSlug]);

  // ── Remix ─────────────────────────────────────────────────────────────────

  const handleRemix = useCallback(() => {
    if (!creation) return;
    trackRemixClicked(creation.creationType, shareSlug);

    const newId = `remix-${Date.now()}`;
    const remixedCreation: Creation = {
      id: newId,
      title: `${creation.title} (my copy)`,
      creationType: creation.creationType as CreationType,
      description: '',
      summary: '',
      originalRequest: '',
      status: 'ready',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      content: remixContent(creation.content, creation.creationType, `${window.location.origin}/s/${shareSlug}`),
      // Keep a reference so the user can navigate back to the original shared pool
      remixSourceUrl: `${window.location.origin}/s/${shareSlug}`,
    };

    const existing = loadCreations();
    saveCreations([...existing, remixedCreation]);
    saveActiveCreationId(newId);
    // Open the main app in a new tab so the shared page stays visible for reference
    window.open('/', '_blank');
  }, [creation]);

  // Save a copy to "My things" without navigating away (used by Recipe read view).
  const handleSaveToCookbook = useCallback((): boolean => {
    if (!creation) return false;
    trackRemixClicked(creation.creationType, shareSlug);
    const newId = `remix-${Date.now()}`;
    const copy: Creation = {
      id: newId,
      title: creation.title,
      creationType: creation.creationType as CreationType,
      description: '',
      summary: '',
      originalRequest: '',
      status: 'ready',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      content: remixContent(creation.content, creation.creationType, `${window.location.origin}/s/${shareSlug}`),
      remixSourceUrl: `${window.location.origin}/s/${shareSlug}`,
    };
    saveCreations([...loadCreations(), copy]);
    return true;
  }, [creation, shareSlug]);

  // ── Badge ─────────────────────────────────────────────────────────────────

  function RoleBadge() {
    const isWorkout = creation?.creationType === 'workout_tracker';
    const participantName = participantRef && isWorkout
      ? ((creation?.content as any).participants ?? []).find((p: any) => p.id === participantRef)?.name
      : undefined;

    if (accessMode === 'admin') {
      return (
        <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
          Admin
        </span>
      );
    }
    if (accessMode === 'participant') {
      return (
        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
          {participantName ? `${participantName}` : 'Participant'}
        </span>
      );
    }
    return (
      <span className="text-xs tp-ink-3 px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: 'rgba(22,21,15,0.05)' }}>
        Viewing
      </span>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div data-testid="shared-tool-loading" className="min-h-screen flex items-center justify-center tp-surface">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl tp-glass flex items-center justify-center mx-auto">
            <span className="tp-ink text-xl animate-pulse">✦</span>
          </div>
          <p className="text-sm tp-ink-3">Loading…</p>
        </div>
      </div>
    );
  }

  if (phase === 'error' || !creation) {
    return (
      <div data-testid="shared-tool-error" className="min-h-screen flex items-center justify-center tp-surface">
        <div className="text-center px-6 space-y-3 max-w-xs">
          <p className="text-4xl">😕</p>
          <h1 className="text-base font-bold tp-ink">Couldn't open this link</h1>
          <p className="text-sm tp-ink-3">{errorMsg ?? 'The link may have expired — ask whoever sent it to share it again.'}</p>
          <button onClick={load} className="text-sm tp-ink font-semibold underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="shared-tool-page" className="min-h-screen tp-surface flex flex-col">
      {/* Header — Velix light/frosted */}
      <header className="bg-white/80 border-b border-black/5 px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <a
            href="/"
            aria-label="Back to Hey Toolie"
            title="Back to Hey Toolie"
            className="w-8 h-8 rounded-full tp-glass flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16150f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </a>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="tp-ink text-xs">✦</span>
            <span className="text-xs font-black tp-ink tracking-tight">Hey Toolie</span>
          </div>
          <span className="tp-ink-3 text-xs">·</span>
          <h1 className="text-sm font-bold tp-ink truncate">{creation.title}</h1>
          <RoleBadge />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saveStatus === 'saving' && <span className="text-xs tp-ink-3">Saving…</span>}
          {saveStatus === 'saved' && <span className="text-xs text-emerald-600">Saved</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-600">Save failed</span>}
          {saveStatus === 'conflict' && (
            <button onClick={load} className="text-xs text-amber-600 underline">
              Refresh to sync
            </button>
          )}
          <button
            data-testid="shared-tool-refresh-btn"
            onClick={load}
            className="text-sm tp-ink-3 px-2 py-1 rounded-lg active:opacity-60"
            aria-label="Refresh"
          >
            ⟳
          </button>
        </div>
      </header>

      {/* Admin banner */}
      {accessMode === 'admin' && (
        <div className="border-b border-black/5 px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(22,21,15,0.03)' }}>
          <span className="text-xs tp-ink-2 flex-1">
            🔑 You're the creator — full edit access. People you share with see view-only.
          </span>
        </div>
      )}

      {/* Viewer banner */}
      {accessMode === 'viewer' && (
        <div className="bg-white border-b border-black/5 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs tp-ink-3">You're viewing someone else's tool</p>
          <button
            data-testid="viewer-remix-btn"
            onClick={handleRemix}
            title="You get your own editable version — the original stays theirs"
            className="tp-btn-dark text-xs font-semibold px-3.5 py-1.5 rounded-full flex-shrink-0 active:scale-95 transition-transform"
          >
            Save my own copy
          </button>
        </div>
      )}

      {/* Sticky brand footer */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-white/80 border-t border-black/5 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="tp-ink text-xs">✦</span>
          <p className="text-xs tp-ink-3 font-medium">Made with Hey Toolie</p>
        </div>
        <a
          href="/"
          className="tp-btn-dark flex-shrink-0 text-xs font-black px-4 py-1.5 rounded-full active:scale-95 transition-transform"
        >
          Create your own ✨
        </a>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-16">
        {/* Participant in Partner Challenge → dedicated participant view */}
        {creation.creationType === 'workout_tracker' && accessMode === 'participant' && participantRef ? (
          <PartnerChallengeParticipantView
            content={creation.content as WorkoutTrackerContent}
            participantRef={participantRef}
            shareSlug={shareSlug}
            token={resolvedAdminToken ?? participantToken ?? ''}
            onUpdate={(updatedContent, version) =>
              setCreation(prev => prev ? { ...prev, content: updatedContent, version } : prev)
            }
          />
        ) : creation.creationType === 'workout_tracker' && accessMode === 'viewer' ? (
          /* Viewer of a Partner Challenge → read-only leaderboard + remix */
          <WorkoutTrackerReadView
            content={creation.content as WorkoutTrackerContent}
            onRemix={handleRemix}
          />
        ) : creation.creationType === 'tournament_pool_tracker' && accessMode !== 'admin' ? (
          /* Viewer or participant in Tournament Pool → read-only view */
          <TournamentPoolReadView
            content={creation.content as TournamentPoolTrackerContent}
            accessMode={accessMode}
            participantRef={participantRef}
            shareSlug={shareSlug}
            token={resolvedAdminToken ?? participantToken}
            onUpdate={(updatedContent, version) =>
              setCreation(prev => prev ? { ...prev, content: updatedContent, version } : prev)
            }
            onRemix={accessMode === 'viewer' ? handleRemix : undefined}
          />
        ) : creation.creationType === 'recipe' && accessMode !== 'admin' ? (
          /* Viewer of a Recipe → read-only view with save / make-it-mine */
          <RecipeReadView
            content={creation.content as RecipeContent}
            onSave={handleSaveToCookbook}
            onMakeMine={handleRemix}
          />
        ) : (
          <>
            {/* Admin change request queue for tournament pool */}
            {creation.creationType === 'tournament_pool_tracker' && accessMode === 'admin' &&
              (() => {
                const pending = ((creation.content as TournamentPoolTrackerContent).changeRequests ?? [])
                  .filter((r: ChangeRequest) => r.status === 'pending');
                if (pending.length === 0) return null;
                const activeToken = resolvedAdminToken ?? participantToken;
                return (
                  <div className="px-4 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                      Change requests ({pending.length})
                    </p>
                    {pending.map((req: ChangeRequest) => (
                      <div
                        key={req.id}
                        className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">{req.participantName}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{req.description}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              if (!activeToken) return;
                              try {
                                const result = await applyCreationAction(
                                  shareSlug, activeToken, 'approve_change_request', { requestId: req.id },
                                );
                                setCreation(prev => prev ? { ...prev, content: result.content as CreationContent, version: result.version } : prev);
                              } catch { /* silent */ }
                            }}
                            className="flex-1 text-xs bg-green-500 text-white rounded-lg py-1.5 font-semibold active:bg-green-600"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={async () => {
                              if (!activeToken) return;
                              try {
                                const result = await applyCreationAction(
                                  shareSlug, activeToken, 'decline_change_request', { requestId: req.id },
                                );
                                setCreation(prev => prev ? { ...prev, content: result.content as CreationContent, version: result.version } : prev);
                              } catch { /* silent */ }
                            }}
                            className="flex-1 text-xs bg-gray-200 text-gray-600 rounded-lg py-1.5 active:bg-gray-300"
                          >
                            ✗ Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            }
            <TemplateRenderer
              creation={{
                id: shareSlug,
                title: creation.title,
                creationType: creation.creationType,
                description: '',
                summary: '',
                originalRequest: '',
                status: 'ready',
                version: creation.version,
                createdAt: creation.createdAt,
                updatedAt: creation.updatedAt,
                content: creation.content,
              }}
              onContentChange={accessMode !== 'viewer' ? (_id, updated) => handleChange(updated) : () => undefined}
            />
          </>
        )}
      </main>
    </div>
  );
}
