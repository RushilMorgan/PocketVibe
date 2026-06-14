import { useEffect, useState } from 'react';
import type { WorldCupTeam, WorldCupMatch } from '../types';
import { getWorldCupData } from '../services/worldCupService';

export interface WorldCupSnapshot {
  teams: WorldCupTeam[];
  matches: WorldCupMatch[];
  loaded: boolean;
}

const EMPTY: WorldCupSnapshot = { teams: [], matches: [], loaded: false };

/**
 * Canonical World Cup data (deduped in the service), refetched every 60s while
 * `enabled` so open pages stay current during match evenings. Shared by the
 * live leaderboard hook and the admin's results editor.
 */
export function useWorldCupData(enabled: boolean): WorldCupSnapshot {
  const [snap, setSnap] = useState<WorldCupSnapshot>(EMPTY);

  useEffect(() => {
    if (!enabled) { setSnap(EMPTY); return; }
    let cancelled = false;
    const load = () => {
      getWorldCupData()
        .then(data => { if (!cancelled) setSnap({ teams: data.teams, matches: data.matches, loaded: true }); })
        .catch(() => { /* offline / not configured — callers degrade gracefully */ });
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [enabled]);

  return snap;
}
