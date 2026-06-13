import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TournamentPoolTrackerContent, TournamentTeam, WorldCupTeam, WorldCupMatch, Creation } from '../types';
import { normaliseTeamName, enrichPoolTeams, isWorldCupPool, liveResultsEnabled, dedupeWorldCupMatches } from '../lib/poolLiveSync';
import { WC2026_SEED_TEAMS, syntheticTeamId } from '../../supabase/functions/sync-world-cup-results/seedTeams';

// ── poolLiveSync ──────────────────────────────────────────────────────────────

function poolTeam(overrides: Partial<TournamentTeam>): TournamentTeam {
  return { id: 't1', name: 'Mexico', pot: 1, status: 'active', ...overrides };
}

function wcTeam(overrides: Partial<WorldCupTeam>): WorldCupTeam {
  return { providerTeamId: 1, name: 'Mexico', stage: 'active', ...overrides };
}

function makePool(overrides: Partial<TournamentPoolTrackerContent> = {}): TournamentPoolTrackerContent {
  return {
    type: 'tournament_pool_tracker',
    poolName: 'Family Pool',
    tournamentName: 'FIFA World Cup 2026',
    participants: [
      { id: 'p1', name: 'Mom', emoji: '⭐' },
      { id: 'p2', name: 'Dad', emoji: '🎯' },
    ],
    teams: [
      poolTeam({ id: 't1', name: 'Mexico', assignedTo: 'p1' }),
      poolTeam({ id: 't2', name: 'South Africa', assignedTo: 'p2' }),
    ],
    matches: [],
    drawLocked: true,
    scoringRules: {
      pointsPerWin: 3, pointsPerDraw: 1, knockoutBonus: 2,
      quarterFinalBonus: 4, semiFinalBonus: 6, finalBonus: 9, winnerBonus: 12,
    },
    teamsSource: 'demo_fallback',
    ...overrides,
  };
}

describe('normaliseTeamName / enrichPoolTeams', () => {
  it('matches fallback display names to canonical names via aliases', () => {
    expect(normaliseTeamName('USA')).toBe('united states');
    expect(normaliseTeamName('Ivory Coast')).toBe("côte d'ivoire");
    expect(normaliseTeamName('Türkiye')).toBe('turkey');
  });

  it('attaches providerTeamId by name and leaves matched teams referentially stable when nothing changes', () => {
    const pool = [poolTeam({ id: 't1', name: 'Mexico' }), poolTeam({ id: 't2', name: 'USA' })];
    const wc = [wcTeam({ providerTeamId: 11, name: 'Mexico' }), wcTeam({ providerTeamId: 22, name: 'United States' })];
    const out = enrichPoolTeams(pool, wc);
    expect(out[0].providerTeamId).toBe(11);
    expect(out[1].providerTeamId).toBe(22); // 'USA' ↔ 'United States' via alias
    // already enriched → same array back
    expect(enrichPoolTeams(out, wc)).toBe(out);
  });
});

describe('dedupeWorldCupMatches', () => {
  const usa = 9_000_100, par = 9_000_200, kor = 9_000_300, cze = 9_000_400;
  const row = (o: Partial<WorldCupMatch>): WorldCupMatch => ({
    providerMatchId: -1, homeTeamId: usa, awayTeamId: par,
    scoreHome: 4, scoreAway: 1, status: 'finished', stage: 'group',
    isManualOverride: false, ...o,
  });

  it('collapses the same group fixture synced under two ids into one row', () => {
    const out = dedupeWorldCupMatches([
      row({ providerMatchId: -1001, matchDate: '2026-06-12' }),
      row({ providerMatchId: -2002, matchDate: '2026-06-13' }), // date drift dupe
      row({ homeTeamId: kor, awayTeamId: cze, scoreHome: 2, scoreAway: 1, providerMatchId: -3003 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.filter(m => m.homeTeamId === usa)).toHaveLength(1);
  });

  it('is orientation-independent (swapped home/away is the same fixture)', () => {
    const out = dedupeWorldCupMatches([
      row({ providerMatchId: -1 }),
      row({ homeTeamId: par, awayTeamId: usa, scoreHome: 1, scoreAway: 4, providerMatchId: -2 }),
    ]);
    expect(out).toHaveLength(1);
  });

  it('keeps the finished/scored row over a scheduled placeholder', () => {
    const out = dedupeWorldCupMatches([
      row({ providerMatchId: -1, status: 'scheduled', scoreHome: undefined, scoreAway: undefined }),
      row({ providerMatchId: -2, status: 'finished' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('finished');
  });

  it('keeps a genuine knockout rematch separate from the group meeting', () => {
    const out = dedupeWorldCupMatches([
      row({ stage: 'group', providerMatchId: -1 }),
      row({ stage: 'round_of_16', providerMatchId: -2 }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('liveResultsEnabled defaults', () => {
  it('World Cup pools without autoSettings default ON (existing live pools)', () => {
    expect(liveResultsEnabled(makePool())).toBe(true);
    expect(isWorldCupPool(makePool({ teamsSource: undefined }))).toBe(true); // by name
  });

  it('explicit setting always wins; non-WC pools default OFF', () => {
    expect(liveResultsEnabled(makePool({
      autoSettings: { autoResultsEnabled: false, resultProvider: 'manual', allowManualOverrides: true, requireAdminApprovalForSuggestedChanges: false },
    }))).toBe(false);
    expect(liveResultsEnabled(makePool({ teamsSource: undefined, tournamentName: 'Office Padel Cup' }))).toBe(false);
  });
});

// ── Edge seed list ────────────────────────────────────────────────────────────

describe('WC2026 seed teams (edge self-seed)', () => {
  it('has all 48 qualifiers including the hosts', () => {
    expect(WC2026_SEED_TEAMS).toHaveLength(48);
    for (const host of ['Mexico', 'USA', 'Canada', 'South Africa']) {
      expect(WC2026_SEED_TEAMS.some(t => t.name === host)).toBe(true);
    }
  });

  it('synthetic ids are stable, unique across the list, and out of provider range', () => {
    const ids = WC2026_SEED_TEAMS.map(t => syntheticTeamId(t.name));
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids)).toBeGreaterThanOrEqual(9_000_000);
    expect(syntheticTeamId('Mexico')).toBe(syntheticTeamId('Mexico'));
  });

  it('seed names match the client fallback names (same normalisation universe)', () => {
    // A canonical match between two seeded teams must map onto a fallback-built pool
    const seedNames = new Set(WC2026_SEED_TEAMS.map(t => normaliseTeamName(t.name)));
    for (const name of ['USA', 'Ivory Coast', 'Cape Verde', 'Bosnia', 'Czechia', 'DR Congo']) {
      expect(seedNames.has(normaliseTeamName(name))).toBe(true);
    }
  });
});

// ── useLiveTournamentScores ───────────────────────────────────────────────────

const getWorldCupDataMock = vi.fn();
vi.mock('../services/worldCupService', () => ({
  getWorldCupData: () => getWorldCupDataMock(),
}));

// Import after the mock so the hook picks it up
const { useLiveTournamentScores } = await import('../hooks/useLiveTournamentScores');

describe('useLiveTournamentScores', () => {
  beforeEach(() => getWorldCupDataMock.mockReset());

  it('scores a canonical result onto a fallback-built pool (no providerTeamIds)', async () => {
    const mexicoId = syntheticTeamId('Mexico');
    const saId = syntheticTeamId('South Africa');
    const wcTeams: WorldCupTeam[] = [
      wcTeam({ providerTeamId: mexicoId, name: 'Mexico' }),
      wcTeam({ providerTeamId: saId, name: 'South Africa' }),
    ];
    const wcMatches: WorldCupMatch[] = [{
      providerMatchId: 1, homeTeamId: mexicoId, awayTeamId: saId,
      scoreHome: 2, scoreAway: 0, status: 'finished', isManualOverride: false,
    }];
    getWorldCupDataMock.mockResolvedValue({ teams: wcTeams, matches: wcMatches });

    const { result } = renderHook(() => useLiveTournamentScores(makePool()));
    await waitFor(() => expect(result.current).not.toBeNull());

    const board = result.current!;
    const mom = board.find(r => r.participant.id === 'p1')!; // owns Mexico (won 2-0)
    const dad = board.find(r => r.participant.id === 'p2')!;
    expect(mom.points).toBeGreaterThan(dad.points);
    expect(mom.wins).toBe(1);
  });

  it('does not double-count a hand-entered score once the canonical result arrives', async () => {
    const mexicoId = syntheticTeamId('Mexico');
    const saId = syntheticTeamId('South Africa');
    getWorldCupDataMock.mockResolvedValue({
      teams: [
        wcTeam({ providerTeamId: mexicoId, name: 'Mexico' }),
        wcTeam({ providerTeamId: saId, name: 'South Africa' }),
      ],
      matches: [{
        providerMatchId: 1, homeTeamId: mexicoId, awayTeamId: saId,
        scoreHome: 2, scoreAway: 0, status: 'finished', isManualOverride: false,
      }] as WorldCupMatch[],
    });
    // Owner hand-entered the same result before the sync caught up
    const pool = makePool({
      matches: [{ id: 'm1', teamAId: 't1', teamBId: 't2', scoreA: 2, scoreB: 0 }],
    });
    const { result } = renderHook(() => useLiveTournamentScores(pool));
    await waitFor(() => expect(result.current).not.toBeNull());
    const mom = result.current!.find(r => r.participant.id === 'p1')!;
    expect(mom.wins).toBe(1); // one fixture, not two
  });

  it('a score-less or half-filled manual entry never eclipses the canonical result', async () => {
    const mexicoId = syntheticTeamId('Mexico');
    const saId = syntheticTeamId('South Africa');
    getWorldCupDataMock.mockResolvedValue({
      teams: [
        wcTeam({ providerTeamId: mexicoId, name: 'Mexico' }),
        wcTeam({ providerTeamId: saId, name: 'South Africa' }),
      ],
      matches: [{
        providerMatchId: 1, homeTeamId: mexicoId, awayTeamId: saId,
        scoreHome: 2, scoreAway: 0, status: 'finished', isManualOverride: false,
      }] as WorldCupMatch[],
    });
    // The owner's entry lost its scores (and they retried, leaving a duplicate)
    const pool = makePool({
      matches: [
        { id: 'm1', teamAId: 't1', teamBId: 't2' },                       // score-less
        { id: 'm2', teamAId: 't2', teamBId: 't1', scoreA: 0 },            // half-filled, swapped
      ],
    });
    const { result } = renderHook(() => useLiveTournamentScores(pool));
    await waitFor(() => expect(result.current).not.toBeNull());
    const mom = result.current!.find(r => r.participant.id === 'p1')!; // owns Mexico
    // Canonical 2–0 scores once; the broken manual entries are consumed silently
    expect(mom.wins).toBe(1);
    expect(mom.points).toBeGreaterThan(0);
  });

  it('scores a duplicated canonical result only once', async () => {
    const mexicoId = syntheticTeamId('Mexico');
    const saId = syntheticTeamId('South Africa');
    const dup = (providerMatchId: number): WorldCupMatch => ({
      providerMatchId, homeTeamId: mexicoId, awayTeamId: saId,
      scoreHome: 2, scoreAway: 0, status: 'finished', stage: 'group', isManualOverride: false,
    });
    getWorldCupDataMock.mockResolvedValue({
      teams: [
        wcTeam({ providerTeamId: mexicoId, name: 'Mexico' }),
        wcTeam({ providerTeamId: saId, name: 'South Africa' }),
      ],
      matches: [dup(-1001), dup(-2002)], // same fixture, two ids
    });
    const { result } = renderHook(() => useLiveTournamentScores(makePool()));
    await waitFor(() => expect(result.current).not.toBeNull());
    const mom = result.current!.find(r => r.participant.id === 'p1')!; // owns Mexico
    expect(mom.wins).toBe(1); // not 2
  });

  it('returns null (pool-only fallback) when live results are disabled', () => {
    const { result } = renderHook(() => useLiveTournamentScores(
      makePool({ autoSettings: { autoResultsEnabled: false, resultProvider: 'manual', allowManualOverrides: true, requireAdminApprovalForSuggestedChanges: false } }),
    ));
    expect(result.current).toBeNull();
    expect(getWorldCupDataMock).not.toHaveBeenCalled();
  });
});

// ── sharePush ─────────────────────────────────────────────────────────────────

const shareMocks = vi.hoisted(() => ({
  getStoredAdminToken: vi.fn(),
  getSharedCreation: vi.fn(),
  updateSharedCreation: vi.fn(),
  updateOwnedCreationContent: vi.fn(),
}));
vi.mock('../services/shareService', () => shareMocks);

const { pushSharedContent } = await import('../lib/sharePush');

function makeCreation(): Creation {
  return {
    id: 'c1', title: 'Pool', creationType: 'tournament_pool_tracker',
    description: '', summary: '', originalRequest: '', status: 'ready',
    version: 1, createdAt: 1, updatedAt: 1, shareSlug: 'j75x8vxh',
    content: makePool(),
  };
}

describe('pushSharedContent', () => {
  beforeEach(() => {
    shareMocks.getStoredAdminToken.mockReset();
    shareMocks.getSharedCreation.mockReset();
    shareMocks.updateSharedCreation.mockReset();
    shareMocks.updateOwnedCreationContent.mockReset();
  });

  it('uses the stored admin token when available', async () => {
    shareMocks.getStoredAdminToken.mockReturnValue('tok-123');
    shareMocks.updateSharedCreation.mockResolvedValue({ version: 2, content: {} });
    const c = makeCreation();
    expect(await pushSharedContent(c)).toBe(true);
    expect(shareMocks.updateSharedCreation).toHaveBeenCalledWith('j75x8vxh', 'tok-123', c.content, undefined);
    expect(shareMocks.getSharedCreation).not.toHaveBeenCalled();
  });

  it('falls back to a version-checked owner update without a token', async () => {
    shareMocks.getStoredAdminToken.mockReturnValue(undefined);
    shareMocks.getSharedCreation.mockResolvedValue({ creation: { version: 7 } });
    shareMocks.updateOwnedCreationContent.mockResolvedValue({ version: 8, content: {} });
    const c = makeCreation();
    expect(await pushSharedContent(c)).toBe(true);
    expect(shareMocks.updateOwnedCreationContent).toHaveBeenCalledWith('j75x8vxh', c.content, 7);
  });

  it('reports failure instead of throwing when everything is down', async () => {
    shareMocks.getStoredAdminToken.mockReturnValue('tok');
    shareMocks.updateSharedCreation.mockRejectedValue(new Error('network'));
    expect(await pushSharedContent(makeCreation())).toBe(false);
  });
});
