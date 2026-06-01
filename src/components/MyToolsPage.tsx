import React, { useEffect, useState } from 'react';
import type { AuthUser } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { getStoredAdminToken, claimStoredCreations } from '../services/shareService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MyTool {
  id: string;
  share_slug: string;
  title: string;
  creation_type: string;
  created_at: string;
  updated_at: string;
  public_view: boolean;
}

interface MyToolsPageProps {
  user: AuthUser;
  onSignOut: () => void;
  onBack: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
};

function timeAgo(isoStr: string): string {
  const ms = new Date(isoStr).getTime();
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(ms).toLocaleDateString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MyToolsPage({ user, onSignOut, onBack }: MyToolsPageProps) {
  const [tools, setTools] = useState<MyTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError('Database not connected.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadTools() {
      // Tools shared while signed out have owner_user_id = NULL and would never
      // show up here. Claim any creations we hold admin tokens for first, so
      // they get associated with this account before we query.
      await claimStoredCreations();
      if (cancelled || !supabase) return;

      const { data, error: err } = await supabase
        .from('shared_creations')
        .select('id, share_slug, title, creation_type, created_at, updated_at, public_view')
        .eq('owner_user_id', user.id)
        .order('updated_at', { ascending: false });

      if (cancelled) return;
      if (err) {
        setError('Could not load your tools.');
      } else {
        setTools(data ?? []);
      }
      setLoading(false);
    }

    loadTools();

    return () => { cancelled = true; };
  }, [user.id]);

  function openTool(tool: MyTool) {
    const adminToken = getStoredAdminToken(tool.share_slug);
    const url = adminToken
      ? `/s/${tool.share_slug}?admin=${encodeURIComponent(adminToken)}`
      : `/s/${tool.share_slug}`;
    window.location.href = url;
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">

      {/* ── Sub-header: email + sign out — title/back are in PVHeader ──── */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-xs text-gray-400 flex-1 truncate">{user.email}</p>
        <button
          onClick={onSignOut}
          className="flex-shrink-0 text-xs text-gray-400 font-medium px-3 py-1.5 rounded-xl active:bg-gray-100"
        >
          Sign out
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-gray-400 animate-pulse">Loading your tools…</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {!loading && !error && tools.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">🔧</p>
            <p className="text-gray-500 text-sm font-medium">No saved tools yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Create a tool and share it — it'll appear here.
            </p>
            <button
              onClick={onBack}
              className="mt-5 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700"
            >
              Make something
            </button>
          </div>
        )}

        {!loading && tools.length > 0 && (
          <div className="flex flex-col gap-3">
            {tools.map(tool => {
              const adminToken = getStoredAdminToken(tool.share_slug);
              return (
                <div
                  key={tool.id}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50 active:bg-gray-100"
                >
                  <span className="text-2xl leading-none flex-shrink-0">
                    {TYPE_EMOJI[tool.creation_type] ?? '🔧'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{tool.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Updated {timeAgo(tool.updated_at)}
                      {adminToken ? ' · Admin access' : ' · View only'}
                    </p>
                  </div>
                  <button
                    onClick={() => openTool(tool)}
                    className="flex-shrink-0 text-xs font-semibold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-xl active:bg-violet-100 whitespace-nowrap"
                  >
                    Open →
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
