import React, { useState, useEffect, useRef } from 'react';
import type { Creation, CreationType } from '../types';
import type { AuthUser } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { getStoredAdminToken } from '../services/shareService';
import { mergeThings, type CloudTool, type UnifiedThing } from '../lib/mergeThings';

interface MyThingsPageProps {
  creations: Creation[];
  activeCreationId: string | null;
  /** Signed-in user, or null when signed out (then only local creations show). */
  user: AuthUser | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSignOut: () => void;
  /** Navigate home (used by the empty-state "Make something" button). */
  onGoHome: () => void;
}

const TYPE_EMOJI: Record<string, string> = {
  checklist: '✅',
  habit_tracker: '🔁',
  budget_calculator: '💰',
  savings_tracker: '💸',
  landing_page: '🌐',
  event_planner: '🎉',
  meal_planner: '🍽️',
  workout_tracker: '💪',
  price_calculator: '🧾',
  task_planner: '📌',
  tournament_pool_tracker: '🏆',
  idea_thinking_board: '💡',
};

const TYPE_LABEL: Record<string, string> = {
  checklist: 'Checklist',
  habit_tracker: 'Habit tracker',
  budget_calculator: 'Budget',
  savings_tracker: 'Savings goal',
  landing_page: 'Landing page',
  event_planner: 'Event planner',
  meal_planner: 'Meal planner',
  workout_tracker: 'Workout plan',
  price_calculator: 'Price calculator',
  task_planner: 'Task planner',
  tournament_pool_tracker: 'Tournament pool',
  idea_thinking_board: 'Idea board',
};

function timeAgo(ms: number): string {
  if (!ms) return '';
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function MyThingsPage({
  creations,
  activeCreationId,
  user,
  onOpen,
  onDelete,
  onDuplicate,
  onRename,
  onSignOut,
  onGoHome,
}: MyThingsPageProps) {
  const [cloud, setCloud] = useState<CloudTool[]>([]);
  const [cloudLoading, setCloudLoading] = useState(Boolean(user));
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch the user's cloud tools and merge them in ──────────────────────────
  useEffect(() => {
    if (!user || !supabase) {
      setCloud([]);
      setCloudLoading(false);
      return;
    }

    setCloudLoading(true);
    // Explicit owner filter is required: anon_can_read_public RLS also applies to
    // authenticated users, so without it this would return other users' public tools.
    supabase
      .from('shared_creations')
      .select('id, share_slug, title, creation_type, created_at, updated_at, public_view')
      .eq('owner_user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setCloud((data as CloudTool[]) ?? []);
        setCloudLoading(false);
      });
  }, [user]);

  useEffect(() => () => { if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current); }, []);

  const things: UnifiedThing[] = mergeThings(creations, cloud);

  function startRename(creation: Creation) {
    setRenamingId(creation.id);
    setRenameValue(creation.title);
  }
  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) onRename(id, trimmed);
    setRenamingId(null);
    setRenameValue('');
  }
  function cancelRename() {
    setRenamingId(null);
    setRenameValue('');
  }

  function handleDelete(id: string) {
    if (confirmDeleteId === id) {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  }

  function openCloudTool(tool: CloudTool) {
    const adminToken = getStoredAdminToken(tool.share_slug);
    window.location.href = adminToken
      ? `/s/${tool.share_slug}?admin=${encodeURIComponent(adminToken)}`
      : `/s/${tool.share_slug}`;
  }

  const isEmpty = things.length === 0 && !cloudLoading;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Account row — only when signed in */}
      {user && (
        <div className="flex items-center gap-3 px-4 pt-3 pb-3 border-b border-gray-100 flex-shrink-0 bg-white">
          <p className="text-xs text-gray-400 flex-1 truncate">{user.email}</p>
          <button
            onClick={onSignOut}
            className="flex-shrink-0 text-xs text-gray-400 font-medium px-3 py-1.5 rounded-xl active:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      )}

      {/* Count / sync subtitle */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-center gap-2">
        <p className="text-xs text-gray-400">
          {things.length} thing{things.length !== 1 ? 's' : ''}
        </p>
        {cloudLoading && (
          <span className="text-xs text-gray-300 animate-pulse">· syncing…</span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4 py-16">
            <div className="w-16 h-16 rounded-3xl bg-violet-100 flex items-center justify-center">
              <span className="text-3xl">✦</span>
            </div>
            <div>
              <p className="text-gray-700 text-sm font-semibold mb-1">Nothing yet</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                Make something and it'll show up here — on this device and your account.
              </p>
            </div>
            <button
              onClick={onGoHome}
              className="mt-1 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700"
            >
              Make something
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-1">
            {things.map(thing =>
              thing.kind === 'local'
                ? renderLocal(thing.creation)
                : renderCloud(thing.tool),
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Renderers ───────────────────────────────────────────────────────────────

  function renderLocal(creation: Creation) {
    const isActive = creation.id === activeCreationId;
    const isConfirming = confirmDeleteId === creation.id;
    return (
      <div
        key={creation.id}
        className={`rounded-2xl px-4 py-3.5 ${
          isActive ? 'bg-violet-600 shadow-lg shadow-violet-200/50' : 'bg-white border border-gray-100 shadow-sm'
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={() => onOpen(creation.id)}
            className="flex items-start gap-3 flex-1 text-left min-w-0"
          >
            <span className="text-2xl leading-none flex-shrink-0 mt-0.5">
              {TYPE_EMOJI[creation.creationType as CreationType] ?? '📄'}
            </span>
            <div className="min-w-0 flex-1">
              {renamingId === creation.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(creation.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(creation.id);
                    if (e.key === 'Escape') cancelRename();
                  }}
                  onClick={e => e.stopPropagation()}
                  maxLength={100}
                  className="w-full text-sm font-semibold border border-violet-400 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-gray-900"
                />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-bold text-sm truncate max-w-[140px] ${isActive ? 'text-white' : 'text-gray-900'}`}>
                    {creation.title}
                  </span>
                  {creation.version > 1 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-white/20 text-white/70' : 'bg-gray-100 text-gray-500'}`}>
                      v{creation.version}
                    </span>
                  )}
                  {creation.shareSlug && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-white/20 text-white/80' : 'bg-violet-50 text-violet-600'}`}>
                      Shared
                    </span>
                  )}
                  {isActive && (
                    <span className="text-xs px-1.5 py-0.5 bg-white/20 text-white rounded-full font-medium flex-shrink-0">
                      Open
                    </span>
                  )}
                </div>
              )}
              <p className={`text-xs mt-0.5 line-clamp-1 ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                {TYPE_LABEL[creation.creationType as CreationType] ?? 'Tool'} · {timeAgo(creation.updatedAt)}
              </p>
            </div>
          </button>

          <div className="flex items-center flex-shrink-0">
            <button
              onClick={e => { e.stopPropagation(); startRename(creation); }}
              className={`w-9 h-9 rounded-full flex items-center justify-center ${isActive ? 'text-white/50 active:bg-white/10' : 'text-gray-300 active:bg-gray-100'}`}
              aria-label="Rename"
              title="Rename"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDuplicate(creation.id); }}
              className={`w-9 h-9 rounded-full flex items-center justify-center ${isActive ? 'text-white/50 active:bg-white/10' : 'text-gray-300 active:bg-gray-100'}`}
              aria-label="Duplicate"
              title="Duplicate"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(creation.id); }}
              className={`w-9 h-9 rounded-full flex items-center justify-center ${isConfirming ? 'text-red-400 active:bg-red-50' : isActive ? 'text-white/30 active:bg-white/10' : 'text-gray-200 active:bg-gray-100'}`}
              aria-label={isConfirming ? 'Tap again to confirm delete' : 'Delete'}
              title={isConfirming ? 'Tap again to confirm' : 'Delete'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        </div>

        {isConfirming && (
          <p className="text-xs text-red-400 mt-1.5 ml-9">Tap delete again to confirm</p>
        )}
      </div>
    );
  }

  function renderCloud(tool: CloudTool) {
    const adminToken = getStoredAdminToken(tool.share_slug);
    const updatedMs = Date.parse(tool.updated_at) || 0;
    return (
      <div
        key={tool.id}
        className="rounded-2xl px-4 py-3.5 bg-white border border-gray-100 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <button
            onClick={() => openCloudTool(tool)}
            className="flex items-start gap-3 flex-1 text-left min-w-0"
          >
            <span className="text-2xl leading-none flex-shrink-0 mt-0.5">
              {TYPE_EMOJI[tool.creation_type] ?? '📄'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm truncate max-w-[150px] text-gray-900">{tool.title}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 bg-violet-50 text-violet-600">
                  {adminToken ? 'Shared' : 'View only'}
                </span>
              </div>
              <p className="text-xs mt-0.5 line-clamp-1 text-gray-400">
                {TYPE_LABEL[tool.creation_type] ?? 'Tool'} · {timeAgo(updatedMs)}
              </p>
            </div>
          </button>
          <button
            onClick={() => openCloudTool(tool)}
            className="flex-shrink-0 text-xs font-semibold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-xl active:bg-violet-100 whitespace-nowrap self-center"
          >
            Open →
          </button>
        </div>
      </div>
    );
  }
}
