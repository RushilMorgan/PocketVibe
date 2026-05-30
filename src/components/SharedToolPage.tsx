import React, { useEffect, useState, useCallback } from 'react';
import type {
  AccessMode,
  SharedCreationData,
  CreationContent,
  WorkoutTrackerContent,
  TournamentPoolTrackerContent,
  ChangeRequest,
  Creation,
  CreationType,
} from '../types';
import {
  getSharedCreation,
  updateSharedCreation,
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
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not load this tool.');
      setPhase('error');
    }
  }, [shareSlug, token]);

  useEffect(() => { load(); }, [load]);

  const handleChange = useCallback(async (updatedContent: CreationContent) => {
    if (!creation) return;
    if (accessMode === 'viewer') return;

    const activeToken = resolvedAdminToken ?? participantToken;
    if (!activeToken) return;

    setSaveStatus('saving');
    try {
      const result = await updateSharedCreation(shareSlug, activeToken, updatedContent, creation.version);
      setCreation(prev => prev ? { ...prev, content: result.content as CreationContent, version: result.version } : prev);
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
      content: remixContent(creation.content, creation.creationType),
    };

    const existing = loadCreations();
    saveCreations([...existing, remixedCreation]);
    saveActiveCreationId(newId);
    window.location.href = '/';
  }, [creation]);

  // ── Badge ─────────────────────────────────────────────────────────────────

  function RoleBadge() {
    const isWorkout = creation?.creationType === 'workout_tracker';
    const participantName = participantRef && isWorkout
      ? ((creation?.content as any).participants ?? []).find((p: any) => p.id === participantRef)?.name
      : undefined;

    if (accessMode === 'admin') {
      return (
        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
          Admin
        </span>
      );
    }
    if (accessMode === 'participant') {
      return (
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          {participantName ? `Viewing as ${participantName}` : 'Participant'}
        </span>
      );
    }
    return (
      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
        Viewing
      </span>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div data-testid="shared-tool-loading" className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-2">
          <div className="text-2xl animate-pulse">⟳</div>
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (phase === 'error' || !creation) {
    return (
      <div data-testid="shared-tool-error" className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6 space-y-3 max-w-xs">
          <p className="text-4xl">😕</p>
          <h1 className="text-base font-semibold text-gray-800">Couldn't load this tool</h1>
          <p className="text-sm text-gray-500">{errorMsg ?? 'This link may have expired or the tool is private.'}</p>
          <button onClick={load} className="text-sm text-violet-600 font-medium underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="shared-tool-page" className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">{creation.title}</h1>
          <RoleBadge />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saveStatus === 'saving' && <span className="text-xs text-gray-400">Saving…</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-600">Saved</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-600">Save failed — try again</span>}
          {saveStatus === 'conflict' && (
            <button onClick={load} className="text-xs text-amber-600 underline">
              Refresh to sync
            </button>
          )}
          <button
            data-testid="shared-tool-refresh-btn"
            onClick={load}
            className="text-sm text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100"
            aria-label="Refresh"
          >
            ⟳
          </button>
        </div>
      </header>

      {/* Viewer banner */}
      {accessMode === 'viewer' && (
        <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">View only — changes won't be saved</p>
          <button
            data-testid="viewer-remix-btn"
            onClick={handleRemix}
            className="text-xs font-semibold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg active:bg-violet-100 flex-shrink-0"
          >
            Make my own version
          </button>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
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
