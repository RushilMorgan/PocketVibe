import React, { useState, useCallback } from 'react';
import type { Creation } from '../types';
import type { WorkoutTrackerContent } from '../types';
import {
  createSharedCreation,
  getStoredAdminToken,
  isShareAvailable,
  claimCreation,
  createParticipantLink,
} from '../services/shareService';

interface SharePanelProps {
  creation: Creation;
  onClose: () => void;
  onCreationShared?: (shareSlug: string) => void;
  isLoggedIn?: boolean;
  onRequestAuth?: () => void;
}

export function SharePanel({ creation, onClose, onCreationShared, isLoggedIn, onRequestAuth }: SharePanelProps) {
  const [phase, setPhase] = useState<'idle' | 'creating' | 'done' | 'error'>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareSlugState, setShareSlugState] = useState<string | null>(null);
  const [adminTokenState, setAdminTokenState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Participant link state (for workout_tracker partner challenges)
  const [participantLinks, setParticipantLinks] = useState<Record<string, string>>({});
  const [participantGenerating, setParticipantGenerating] = useState<string | null>(null);
  const [participantCopied, setParticipantCopied] = useState<string | null>(null);

  // If already shared, derive the view URL from the existing slug
  const existingSlug = creation.shareSlug;
  const isAlreadyShared = Boolean(existingSlug);
  const existingViewUrl = existingSlug
    ? `${window.location.origin}/s/${existingSlug}`
    : null;

  const isWorkoutTracker = creation.creationType === 'workout_tracker';
  const participants = isWorkoutTracker
    ? ((creation.content as WorkoutTrackerContent).participants ?? [])
    : [];

  async function handleCreate() {
    if (!isShareAvailable()) {
      setError('Sharing requires an internet connection.');
      setPhase('error');
      return;
    }
    setPhase('creating');
    setError(null);
    try {
      const result = await createSharedCreation(creation);
      setShareUrl(result.viewUrl);
      setShareSlugState(result.shareSlug);
      setAdminTokenState(result.adminToken);
      setPhase('done');
      onCreationShared?.(result.shareSlug);
      // Associate with account if signed in
      if (isLoggedIn) {
        claimCreation(result.shareSlug, result.adminToken).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setPhase('error');
    }
  }

  async function handleCopy(url: string) {
    try {
      if (navigator.share) {
        await navigator.share({ title: creation.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* clipboard blocked */ }
    }
  }

  async function handleGenerateParticipantLink(participantId: string, displayName: string, emoji?: string) {
    const slug = shareSlugState ?? existingSlug;
    const token = adminTokenState ?? (slug ? getStoredAdminToken(slug) : undefined);
    if (!slug || !token) return;

    setParticipantGenerating(participantId);
    try {
      const result = await createParticipantLink(slug, token, participantId, displayName, emoji);
      setParticipantLinks(prev => ({ ...prev, [participantId]: result.participantUrl }));
    } catch {
      // silently fail — button remains clickable to retry
    } finally {
      setParticipantGenerating(null);
    }
  }

  async function handleCopyParticipantLink(participantId: string, url: string) {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${creation.title} — your link`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setParticipantCopied(participantId);
      setTimeout(() => setParticipantCopied(null), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setParticipantCopied(participantId);
        setTimeout(() => setParticipantCopied(null), 2000);
      } catch { /* blocked */ }
    }
  }

  // ── Participant links section (workout_tracker only) ───────────────────────
  function ParticipantLinksSection({ slug, token }: { slug: string; token: string | undefined }) {
    if (!isWorkoutTracker || participants.length === 0) return null;
    return (
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Participant links
        </p>
        <p className="text-xs text-gray-400">
          Each participant gets their own personal link so they can log their own activity.
        </p>
        {participants.map(p => {
          const pUrl = participantLinks[p.id];
          const isGenerating = participantGenerating === p.id;
          const isCopied = participantCopied === p.id;
          return (
            <div key={p.id} className="flex items-center gap-2">
              <span className="flex-shrink-0 text-base">{p.emoji ?? '🏃'}</span>
              <span className="flex-1 text-sm text-gray-700 truncate">{p.name}</span>
              {pUrl ? (
                <button
                  data-testid={`copy-participant-link-${p.id}`}
                  onClick={() => handleCopyParticipantLink(p.id, pUrl)}
                  className="flex-shrink-0 text-xs font-semibold text-white bg-violet-600 px-3 py-1.5 rounded-xl active:bg-violet-700"
                >
                  {isCopied ? '✓ Copied' : typeof navigator.share === 'function' ? '↗ Share' : 'Copy'}
                </button>
              ) : (
                <button
                  data-testid={`get-participant-link-${p.id}`}
                  onClick={() => handleGenerateParticipantLink(p.id, p.name, p.emoji)}
                  disabled={isGenerating || !token}
                  className="flex-shrink-0 text-xs font-semibold text-violet-600 border border-violet-200 bg-violet-50 px-3 py-1.5 rounded-xl active:bg-violet-100 disabled:opacity-50"
                >
                  {isGenerating ? 'Getting…' : 'Get link'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Already-shared view ────────────────────────────────────────────────────
  if (isAlreadyShared && existingViewUrl && phase !== 'done') {
    const existingToken = existingSlug ? getStoredAdminToken(existingSlug) : undefined;
    return (
      <Sheet onClose={onClose}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Share this tool</h2>
        <p className="text-sm text-gray-500 mb-4">Copy the link and send it to anyone.</p>

        <UrlDisplay url={existingViewUrl} copied={copied} onCopy={() => handleCopy(existingViewUrl)} />

        {existingSlug && (
          <ParticipantLinksSection slug={existingSlug} token={existingToken} />
        )}

        <button onClick={onClose} className="w-full py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-600 font-medium mt-3">
          Done
        </button>
      </Sheet>
    );
  }

  // ── Not yet shared ─────────────────────────────────────────────────────────
  if (phase === 'idle' || phase === 'error' || phase === 'creating') {
    // Not signed in — require auth before sharing
    if (!isLoggedIn && onRequestAuth) {
      return (
        <Sheet onClose={onClose}>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Share this tool</h2>
          <p className="text-sm text-gray-500 mb-4">
            You need a free account to create a share link — so you can always edit it later.
          </p>
          <button
            onClick={onRequestAuth}
            className="w-full py-3 rounded-2xl bg-violet-600 text-white font-semibold text-sm active:bg-violet-700 transition-colors"
          >
            Sign in / create free account
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-500 font-medium mt-2"
          >
            Not now
          </button>
        </Sheet>
      );
    }

    return (
      <Sheet onClose={onClose}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Share this tool</h2>
        <p className="text-sm text-gray-500 mb-4">
          {isWorkoutTracker
            ? 'Create a link to share the leaderboard, then generate personal links for each participant.'
            : 'Create a link so anyone can view this tool.'}
        </p>

        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 mb-3">
            {error}
          </div>
        )}

        <button
          data-testid="create-share-link-btn"
          onClick={handleCreate}
          disabled={phase === 'creating' || !isShareAvailable()}
          className="w-full py-3 rounded-2xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-50 active:bg-violet-700 transition-colors"
        >
          {phase === 'creating' ? 'Creating link…' : '✨ Create share link'}
        </button>
      </Sheet>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === 'done' && shareUrl) {
    return (
      <Sheet onClose={onClose}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Share this tool</h2>
        <p className="text-sm text-gray-500 mb-4">Copy the link and send it to anyone.</p>

        <UrlDisplay url={shareUrl} copied={copied} onCopy={() => handleCopy(shareUrl)} />

        {shareSlugState && (
          <ParticipantLinksSection slug={shareSlugState} token={adminTokenState ?? undefined} />
        )}

        <button onClick={onClose} className="w-full py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-600 font-medium mt-3">
          Done
        </button>
      </Sheet>
    );
  }

  return null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      data-testid="share-panel"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1" />
          <button onClick={onClose} className="text-gray-400 text-xl leading-none p-1">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UrlDisplay({ url, copied, onCopy }: { url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 flex items-center gap-3">
      <p className="flex-1 text-xs text-violet-700 font-mono truncate">{url}</p>
      <button
        data-testid="copy-share-link-btn"
        onClick={onCopy}
        className="flex-shrink-0 text-xs font-semibold text-white bg-violet-600 px-3 py-1.5 rounded-xl active:bg-violet-700"
      >
        {copied ? '✓ Copied' : typeof navigator.share === 'function' ? '↗ Share' : 'Copy'}
      </button>
    </div>
  );
}
