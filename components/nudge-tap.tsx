'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { api } from './api';

const ACTIONS = new Set(['open', 'read', 'play']);

/**
 * Notifications open pages with ?n=<nudge id>&a=<open|read|play>. This reports
 * the tap once, then removes those two params from the live URL (keeping any
 * others, like ?play=1) so a reload or Back doesn't count it again.
 * history.replaceState is synchronous and Next keeps its router in step, so
 * this can't race with the item page dropping ?play=1.
 */
export function NudgeTap() {
  const params = useSearchParams();
  const sent = useRef<string | null>(null);
  const nudgeId = params.get('n');

  useEffect(() => {
    if (!nudgeId || sent.current === nudgeId) return;
    sent.current = nudgeId;
    const live = new URLSearchParams(window.location.search);
    const action = live.get('a');
    api(`/api/nudges/${nudgeId}/tap`, { body: { action: action && ACTIONS.has(action) ? action : 'open' } }).catch(() => {});
    live.delete('n');
    live.delete('a');
    const query = live.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [nudgeId]);

  return null;
}
