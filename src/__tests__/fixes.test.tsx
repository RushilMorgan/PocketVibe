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

  it('workout_tracker IS in PUBLIC_VIEW_BY_DEFAULT (partner can view the leaderboard)', () => {
    const src = readEdgeFn('create-shared-creation');
    // Extract the set body
    const setMatch = src.match(/PUBLIC_VIEW_BY_DEFAULT[\s\S]*?new Set\(\[[\s\S]*?\]\)/m)?.[0] ?? '';
    expect(setMatch).toContain('workout_tracker');
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

  it('shows single copy button when creation.shareSlug is set', async () => {
    const slug = 'testslug1';
    const { SharePanel } = await import('../components/SharePanel');
    const creation = makePoolCreation({ shareSlug: slug });

    render(<SharePanel creation={creation} onClose={vi.fn()} />);

    // One link model: shows the copy button for the existing URL
    expect(screen.getByTestId('copy-share-link-btn')).toBeInTheDocument();
    // Should NOT show the create button
    expect(screen.queryByTestId('create-share-link-btn')).not.toBeInTheDocument();
  });

  it('shows the view URL containing the shareSlug', async () => {
    const slug = 'testslug2';
    const { SharePanel } = await import('../components/SharePanel');
    const creation = makePoolCreation({ shareSlug: slug });

    render(<SharePanel creation={creation} onClose={vi.fn()} />);

    // The displayed URL should contain the slug
    expect(screen.getByText(new RegExp(slug))).toBeInTheDocument();
  });

  it('shows standard create button when no shareSlug exists', async () => {
    const { SharePanel } = await import('../components/SharePanel');
    const creation = makePoolCreation();

    render(<SharePanel creation={creation} onClose={vi.fn()} />);

    expect(screen.getByTestId('create-share-link-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('copy-share-link-btn')).not.toBeInTheDocument();
  });
});

// ── NEW FIX: get-shared-creation access control ───────────────────────────────

describe('get-shared-creation — access control', () => {
  it('source checks token BEFORE checking public_view', () => {
    const src = readEdgeFn('get-shared-creation');
    // The public_view guard must come AFTER the token-resolution block.
    // The token block uses "accessMode !== 'admin' && token" as its condition.
    const tokenCheckIdx = src.indexOf("accessMode !== 'admin' && token");
    const publicViewGuardIdx = src.indexOf("accessMode === 'viewer' && !row.public_view");
    expect(tokenCheckIdx).toBeGreaterThan(-1);
    expect(publicViewGuardIdx).toBeGreaterThan(-1);
    expect(publicViewGuardIdx).toBeGreaterThan(tokenCheckIdx);
  });

  it('private creation with no token returns 403', () => {
    const src = readEdgeFn('get-shared-creation');
    expect(src).toContain("accessMode === 'viewer' && !row.public_view");
    expect(src).toContain('This creation is private');
    expect(src).toContain('403');
  });

  it('source no longer has early public_view guard before token check', () => {
    const src = readEdgeFn('get-shared-creation');
    // The broken early-return must not exist
    expect(src).not.toContain('if (!row.public_view) return json');
  });

  it('admin access flows through token check before privacy check', () => {
    const src = readEdgeFn('get-shared-creation');
    // Must set accessMode = 'admin' in token block
    expect(src).toContain("accessMode = 'admin'");
    expect(src).toContain("accessMode = 'participant'");
  });
});

// ── NEW FIX: SharePanel — single link model ────────────────────────────────────

describe('SharePanel — single link model', () => {
  function makeWorkoutCreation(overrides: Partial<Creation> = {}): Creation {
    return {
      id: 'c2',
      title: 'Partner Challenge',
      creationType: 'workout_tracker',
      description: '',
      summary: '',
      originalRequest: '',
      status: 'ready',
      version: 1,
      createdAt: 0,
      updatedAt: 0,
      content: {
        type: 'workout_tracker',
        planName: 'Partner Challenge',
        challengeMode: true,
        participants: [],
        weeklyTarget: 3,
        scoringRules: { pointsPerActivity: 10, weeklyTargetBonus: 20, runningBonus: 5 },
        logs: [],
      },
      ...overrides,
    };
  }

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('Partner Challenge: existing share shows single copy button', async () => {
    const slug = 'privateslug';
    const { SharePanel } = await import('../components/SharePanel');
    const creation = makeWorkoutCreation({ shareSlug: slug });
    render(<SharePanel creation={creation} onClose={vi.fn()} />);
    // One link for everyone — just the copy button
    expect(screen.getByTestId('copy-share-link-btn')).toBeInTheDocument();
    // No separate admin/view distinction
    expect(screen.queryByTestId('copy-existing-admin-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('copy-existing-view-link')).not.toBeInTheDocument();
  });

  it('World Cup Pool: existing share shows single copy button', async () => {
    const slug = 'publicslug';
    const { SharePanel } = await import('../components/SharePanel');
    const creation = makePoolCreation({ shareSlug: slug });
    render(<SharePanel creation={creation} onClose={vi.fn()} />);
    expect(screen.getByTestId('copy-share-link-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('copy-existing-admin-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('copy-existing-view-link')).not.toBeInTheDocument();
  });
});

// ── NEW FIX 6: No duplicate JSX props ─────────────────────────────────────────

describe('SharePanel — no duplicate JSX props', () => {
  it('SharePanel source has no duplicate onCopy prop on the same UrlDisplay element', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../components/SharePanel.tsx'),
      'utf8',
    );
    // Split into UrlDisplay elements and check no element has onCopy twice
    const elements = src.split('<UrlDisplay');
    for (const el of elements.slice(1)) {
      const closingIdx = el.indexOf('/>');
      const elementSrc = el.slice(0, closingIdx);
      const count = (elementSrc.match(/onCopy=/g) ?? []).length;
      expect(count).toBeLessThanOrEqual(1);
    }
  });
});

// ── NEW FIX 5: No gambling/money wording in HomeScreen ────────────────────────

describe('HomeScreen — no gambling wording in public copy', () => {
  it('does not contain money-in-the-pot phrasing', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../components/HomeScreen.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/put money in the pot/i);
    expect(src).not.toMatch(/whoever wins gets the money/i);
    expect(src).not.toMatch(/putting money together/i);
  });

  it('uses friendly pool / leaderboard language', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../components/HomeScreen.tsx'),
      'utf8',
    );
    expect(src).toMatch(/friendly/i);
    expect(src).toMatch(/leaderboard/i);
  });
});

// ── Schema — unique constraint ────────────────────────────────────────────────

describe('schema.sql — participant unique constraint', () => {
  it('defines unique constraint on (shared_creation_id, participant_ref)', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/schema.sql'),
      'utf8',
    );
    expect(src).toContain('shared_participants_creation_ref_unique');
     // Must use CREATE UNIQUE INDEX (not ADD CONSTRAINT IF NOT EXISTS — invalid PostgreSQL syntax)
     expect(src).toContain('CREATE UNIQUE INDEX IF NOT EXISTS shared_participants_creation_ref_unique');
     expect(src).toContain('ON shared_participants (shared_creation_id, participant_ref)');
       // Strip SQL comments before checking — comments explaining the fix may mention the old syntax
       const stripped = src.replace(/--[^\n]*/g, '');
       expect(stripped).not.toMatch(/ADD\s+CONSTRAINT\s+IF\s+NOT\s+EXISTS/i);
  });
});
