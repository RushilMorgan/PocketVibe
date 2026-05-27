import React, { useEffect, useState, useCallback } from 'react';
import type { AccessMode, SharedCreationData, CreationContent } from '../types';
import {
  getSharedCreation,
  updateSharedCreation,
  getStoredAdminToken,
} from '../services/shareService';
import { TemplateRenderer } from './templates/TemplateRenderer';

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict'>('idle');

  // Prefer stored admin token from localStorage over URL param
  const resolvedAdminToken = adminToken ?? getStoredAdminToken(shareSlug);
  const token = resolvedAdminToken ?? participantToken;

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
        setSaveStatus('idle');
      }
    }
  }, [creation, accessMode, resolvedAdminToken, participantToken, shareSlug]);

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
        <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 text-center">
          <p className="text-xs text-gray-400">You're viewing a shared tool — changes won't be saved</p>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
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
      </main>
    </div>
  );
}
