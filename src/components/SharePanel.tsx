import React, { useState, useCallback } from 'react';
import type { Creation } from '../types';
import {
  createSharedCreation,
  getStoredAdminToken,
  isShareAvailable,
  claimCreation,
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
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [skipAuth, setSkipAuth] = useState(false);

  // If already shared, derive the view URL from the existing slug
  const existingSlug = creation.shareSlug;
  const isAlreadyShared = Boolean(existingSlug);
  const existingViewUrl = existingSlug
    ? `${window.location.origin}/s/${existingSlug}`
    : null;

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

  // ── Already-shared view ────────────────────────────────────────────────────
  if (isAlreadyShared && existingViewUrl && phase !== 'done') {
    return (
      <Sheet onClose={onClose}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Share this tool</h2>
        <p className="text-sm text-gray-500 mb-4">Copy the link and send it to anyone.</p>

        <UrlDisplay url={existingViewUrl} copied={copied} onCopy={() => handleCopy(existingViewUrl)} />

        <button onClick={onClose} className="w-full py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-600 font-medium mt-3">
          Done
        </button>
      </Sheet>
    );
  }

  // ── Not yet shared ─────────────────────────────────────────────────────────
  if (phase === 'idle' || phase === 'error' || phase === 'creating') {
    return (
      <Sheet onClose={onClose}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Share this tool</h2>
        <p className="text-sm text-gray-500 mb-4">
          Create a link so anyone can view this tool — no account needed.
        </p>

        {/* Auth nudge */}
        {!isLoggedIn && !skipAuth && onRequestAuth && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">Save your access</p>
              <p className="text-xs text-amber-700 mt-1">
                Sign in so you can always edit this tool from any device.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onRequestAuth}
                className="flex-1 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold active:bg-amber-700"
              >
                Sign in / create account
              </button>
              <button
                onClick={() => setSkipAuth(true)}
                className="text-xs text-amber-600 font-medium px-3 py-2 rounded-xl hover:bg-amber-100"
              >
                Skip
              </button>
            </div>
          </div>
        )}

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
