import React, { useState, useCallback } from 'react';
import type { Creation } from '../types';
import {
  createSharedCreation,
  createParticipantLink,
  getStoredAdminToken,
  isShareAvailable,
} from '../services/shareService';

interface SharePanelProps {
  creation: Creation;
  onClose: () => void;
  onCreationShared?: (shareSlug: string) => void;
}

interface ShareLinks {
  shareSlug: string;
  viewUrl: string;
  adminUrl: string;
  participantLinks: { name: string; emoji: string; url: string }[];
}

export function SharePanel({ creation, onClose, onCreationShared }: SharePanelProps) {
  const [phase, setPhase] = useState<'idle' | 'creating' | 'done' | 'error'>('idle');
  const [links, setLinks] = useState<ShareLinks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // If already shared, show existing links without re-creating
  const existingSlug = creation.shareSlug;
  const existingAdminToken = existingSlug ? getStoredAdminToken(existingSlug) : undefined;
  const isAlreadyShared = Boolean(existingSlug);

  const isWorkout = creation.creationType === 'workout_tracker';
  const isTournament = creation.creationType === 'tournament_pool_tracker';

  const participants: { id: string; name: string; emoji?: string }[] =
    isWorkout
      ? ((creation.content as any).participants ?? [])
      : isTournament
        ? ((creation.content as any).participants ?? [])
        : [];

  async function handleCreate() {
    if (!isShareAvailable()) {
      setError('Sharing requires an internet connection and server setup.');
      setPhase('error');
      return;
    }
    setPhase('creating');
    setError(null);
    try {
      const result = await createSharedCreation(creation);
      const slug = result.shareSlug;
      const adminToken = result.adminToken;

      // Create participant links for flagship tools
      const participantLinks: ShareLinks['participantLinks'] = [];
      for (const p of participants) {
        try {
          const pl = await createParticipantLink(slug, adminToken, p.id, p.name, p.emoji);
          participantLinks.push({ name: p.name, emoji: p.emoji ?? '👤', url: pl.participantUrl });
        } catch {
          // Non-fatal — still return view + admin links
        }
      }

      setLinks({ shareSlug: slug, viewUrl: result.viewUrl, adminUrl: result.adminUrl, participantLinks });
      setPhase('done');
      onCreationShared?.(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setPhase('error');
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* clipboard not available */
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="share-panel"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Share this tool</h2>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none p-1">×</button>
        </div>

        {/* ── Already-shared info ── */}
        {isAlreadyShared && phase !== 'done' && (
          <div className="space-y-3">
            <div className="px-3 py-2.5 bg-violet-50 border border-violet-100 rounded-xl text-sm text-violet-700">
              ✅ This tool was already shared.
            </div>

            {existingAdminToken ? (
              <>
                <LinkRow
                  label="View link"
                  url={`${typeof window !== 'undefined' ? window.location.origin : 'https://heytoolie.com'}/s/${existingSlug}`}
                  copiedKey={copiedKey}
                  myKey="existing-view"
                  onCopy={copy}
                  testId="copy-existing-view-link"
                />
                <LinkRow
                  label="Admin link (keep private)"
                  sublabel="Lets you edit everything"
                  url={`${typeof window !== 'undefined' ? window.location.origin : 'https://heytoolie.com'}/s/${existingSlug}?admin=${existingAdminToken}`}
                  copiedKey={copiedKey}
                  myKey="existing-admin"
                  onCopy={copy}
                  testId="copy-existing-admin-link"
                  warn
                />
              </>
            ) : (
              <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                ⚠️ This tool was shared before, but the private admin link is not saved on this device. Create a new share link below if you need admin access.
              </div>
            )}

            <button
              data-testid="create-new-share-link-btn"
              onClick={handleCreate}
              disabled={phase === 'creating' || !isShareAvailable()}
              className="w-full py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-600 font-medium disabled:opacity-50"
            >
              {phase === 'creating' ? 'Creating…' : '+ Create a new share link'}
            </button>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <button onClick={onClose} className="w-full py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-600 font-medium mt-1">Done</button>
          </div>
        )}

        {/* ── Idle / error / creating — for not-yet-shared ── */}
        {!isAlreadyShared && (phase === 'idle' || phase === 'error' || phase === 'creating') && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Create a link so others can view or use this tool — no account needed.
            </p>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            {!isShareAvailable() && (
              <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                ⚠️ Sharing isn't available right now. Check your internet connection.
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
          </div>
        )}

        {/* ── Done — show links ── */}
        {phase === 'done' && links && (
          <div className="space-y-3">
            {/* View link */}
            <LinkRow
              label="Anyone with this link can view"
              url={links.viewUrl}
              copiedKey={copiedKey}
              myKey="view"
              onCopy={copy}
              testId="copy-view-link-btn"
            />

            {/* Admin link */}
            <LinkRow
              label="Keep this admin link private"
              sublabel="Lets you edit everything"
              url={links.adminUrl}
              copiedKey={copiedKey}
              myKey="admin"
              onCopy={copy}
              testId="copy-admin-link-btn"
              warn
            />

            {/* Participant links */}
            {links.participantLinks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-1">
                  Participant links
                </p>
                {links.participantLinks.map((pl, i) => (
                  <LinkRow
                    key={pl.name}
                    label={`${pl.emoji} Send this to ${pl.name}`}
                    sublabel="Lets them log their own activity"
                    url={pl.url}
                    copiedKey={copiedKey}
                    myKey={`p-${i}`}
                    onCopy={copy}
                    testId={`copy-participant-link-${pl.name.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                ))}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-600 font-medium mt-1"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

interface LinkRowProps {
  label: string;
  sublabel?: string;
  url: string;
  copiedKey: string | null;
  myKey: string;
  onCopy: (url: string, key: string) => void;
  testId?: string;
  warn?: boolean;
}

function LinkRow({ label, sublabel, url, copiedKey, myKey, onCopy, testId, warn }: LinkRowProps) {
  const copied = copiedKey === myKey;
  return (
    <div className={`px-3 py-2.5 rounded-xl border ${warn ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${warn ? 'text-amber-800' : 'text-gray-700'}`}>{label}</p>
          {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
          <p className="text-xs text-gray-400 truncate mt-1 font-mono">{url}</p>
        </div>
        <button
          data-testid={testId}
          onClick={() => onCopy(url, myKey)}
          className="flex-shrink-0 text-xs font-semibold text-violet-600 px-2 py-1 rounded-lg bg-white border border-violet-100 active:bg-violet-50"
        >
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
