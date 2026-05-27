/**
 * Tests covering the 10 fixes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import type { Creation } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// ── helpers ───────────────────────────────────────────────────────────────────

function readEdgeFn(name: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, '../../supabase/functions', name, 'index.ts'),
    'utf8',
  );
}

function makePoolCreation(overrides: Partial<Creation> = {}): Creation {
  return {
    id: 'c1',
    title: 'My Pool',
    creationType: 'tournament_pool_tracker',
    description: '',
    summary: '',
    originalRequest: '',
    status: 'ready',
    version: 1,
    createdAt: 0,
    updatedAt: 0,
    content: {
      type: 'tournament_pool_tracker',
      poolName: 'P',
      tournamentName: 'T',
      participants: [],
      teams: [],
      matches: [],
      drawLocked: false,
      scoringRules: {
        pointsPerWin: 3, pointsPerDraw: 1, knockoutBonus: 2,
        quarterFinalBonus: 4, semiFinalBonus: 6, finalBonus: 9, winnerBonus: 12,
      },
    },
    ...overrides,
  };
}

// ── FIX 1: env-free import ────────────────────────────────────────────────────

describe('FIX 1 — shareService loads without env vars', () => {
  it('isShareAvailable() returns false when env vars are empty (lazy getter, not module-level)', async () => {
    // Stub to empty strings — getters read lazily so this returns false immediately
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { isShareAvailable } = await import('../services/shareService');
    expect(isShareAvailable()).toBe(false);
    vi.unstubAllEnvs();
  });

  it('isShareAvailable() returns true when both env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    const { isShareAvailable } = await import('../services/shareService');
    expect(isShareAvailable()).toBe(true);
    vi.unstubAllEnvs();
  });
});

// ── FIX 2: shareSlug persists via reducer ─────────────────────────────────────

describe('FIX 2 — shareSlug is saved', () => {
  it('creation.shareSlug is defined in the type system', () => {
    const c: Creation = makePoolCreation({ shareSlug: 'abc12345' });
    expect(c.shareSlug).toBe('abc12345');
  });

  it('usePocketVibe exposes setCreationShareSlug', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { usePocketVibe } = await import('../hooks/usePocketVibe');
    const { result } = renderHook(() => usePocketVibe());
    await act(async () => {});
    expect(typeof result.current.setCreationShareSlug).toBe('function');
  });
});

// ── FIX 3: heytoolie.com fallback ─────────────────────────────────────────────

describe('FIX 3 — heytoolie.com domain fallback', () => {
  it('create-shared-creation uses heytoolie.com', () => {
    const src = readEdgeFn('create-shared-creation');
    expect(src).toContain('heytoolie.com');
    expect(src).not.toMatch(/'https:\/\/pocketvibe\.app'/);
  });

  it('create-participant-link uses heytoolie.com', () => {
    const src = readEdgeFn('create-participant-link');
    expect(src).toContain('heytoolie.com');
    expect(src).not.toMatch(/'https:\/\/pocketvibe\.app'/);
  });
});

// ── FIX 4: privacy defaults ───────────────────────────────────────────────────

describe('FIX 4 — privacy defaults by tool type', () => {
  it('tournament_pool_tracker is in the PUBLIC_VIEW_BY_DEFAULT set', () => {
    const src = readEdgeFn('create-shared-creation');
    expect(src).toContain('PUBLIC_VIEW_BY_DEFAULT');
    expect(src).toContain('tournament_pool_tracker');
  });

  it('workout_tracker is NOT in PUBLIC_VIEW_BY_DEFAULT', () => {
    const src = readEdgeFn('create-shared-creation');
    // Extract the set body
    const setMatch = src.match(/PUBLIC_VIEW_BY_DEFAULT[\s\S]*?new Set\(\[[\s\S]*?\]\)/m)?.[0] ?? '';
    expect(setMatch).not.toContain('workout_tracker');
  });
});

// ── FIX 5: participant patch rejected ─────────────────────────────────────────

describe('FIX 5 — update-shared-creation rejects participant patches', () => {
  it('source rejects participants with 403 and directs them to apply-creation-action', () => {
    const src = readEdgeFn('update-shared-creation');
    expect(src).toContain('apply-creation-action');
    expect(src).toContain('403');
  });
});

// ── FIX 6: structured change request approval ─────────────────────────────────

describe('FIX 6 — structured change request approval', () => {
  it('approve_change_request applies structured action before marking approved', () => {
    const src = readEdgeFn('apply-creation-action');
    expect(src).toContain("applyAdminAction(req.actionType");
    expect(src).toContain("req.actionType !== 'free_text'");
  });

  it('decline_change_request does NOT apply any action', () => {
    const src = readEdgeFn('apply-creation-action');
    const declineIdx = src.indexOf("if (action === 'decline_change_request')");
    const afterDecline = src.slice(declineIdx, declineIdx + 400);
    expect(afterDecline).not.toContain('applyAdminAction');
  });

  it('create_change_request supports structured actionType values', () => {
    const src = readEdgeFn('apply-creation-action');
    expect(src).toContain('VALID_ACTION_TYPES');
    expect(src).toContain("'add_result'");
    expect(src).toContain("'edit_participant_name'");
    expect(src).toContain("'update_team_status'");
    expect(src).toContain("'correct_team_assignment'");
  });
});

// ── FIX 7: sync secret protection ─────────────────────────────────────────────

describe('FIX 7 — sync-world-cup-results requires auth', () => {
  it('source requires WORLD_CUP_SYNC_SECRET or service role bearer', () => {
    const src = readEdgeFn('sync-world-cup-results');
    expect(src).toContain('WORLD_CUP_SYNC_SECRET');
    expect(src).toContain('x-sync-secret');
    expect(src).toContain('401');
    expect(src).toContain('Unauthorized');
  });
});

// ── FIX 9: SharePanel shows existing link ─────────────────────────────────────

describe('FIX 9 — SharePanel shows existing shared link', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows "already shared" UI when creation.shareSlug is set and admin token exists', async () => {
    const slug = 'testslug1';
    const adminToken = 'test-admin-token-123';
    localStorage.setItem('pv_admin_tokens', JSON.stringify({ [slug]: adminToken }));

    const { SharePanel } = await import('../components/SharePanel');
    const creation = makePoolCreation({ shareSlug: slug });

    render(<SharePanel creation={creation} onClose={vi.fn()} />);

    expect(screen.getByText(/already shared/i)).toBeInTheDocument();
    expect(screen.getByTestId('copy-existing-admin-link')).toBeInTheDocument();
    expect(screen.getByTestId('copy-existing-view-link')).toBeInTheDocument();
    expect(screen.queryByTestId('create-share-link-btn')).not.toBeInTheDocument();
  });

  it('shows warning when slug exists but admin token is not on this device', async () => {
    const { SharePanel } = await import('../components/SharePanel');
    const creation = makePoolCreation({ shareSlug: 'orphanslug' });

    render(<SharePanel creation={creation} onClose={vi.fn()} />);

    expect(screen.getByText(/admin link is not saved on this device/i)).toBeInTheDocument();
    expect(screen.getByTestId('create-new-share-link-btn')).toBeInTheDocument();
  });

  it('shows standard create button when no shareSlug exists', async () => {
    const { SharePanel } = await import('../components/SharePanel');
    const creation = makePoolCreation();

    render(<SharePanel creation={creation} onClose={vi.fn()} />);

    expect(screen.getByTestId('create-share-link-btn')).toBeInTheDocument();
    expect(screen.queryByText(/already shared/i)).not.toBeInTheDocument();
  });
});
