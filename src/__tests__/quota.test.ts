/**
 * Tests for the client-side daily quota system:
 *  - usageStore: set/get/subscribe/exhausted
 *  - quotaErrorFromBody / recordUsage parsing in aiService
 *  - quotaMessage formatting (reset hints, tier-aware copy, remaining labels)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setUsage,
  setExhausted,
  getUsage,
  getRemaining,
  subscribe,
  _resetUsageStore,
} from '../lib/usageStore';
import {
  formatResetHint,
  formatQuotaMessage,
  formatRemainingLabel,
} from '../lib/quotaMessage';
import { quotaErrorFromBody, recordUsage, QuotaExceededError } from '../services/aiService';

beforeEach(() => {
  _resetUsageStore();
});

// ── usageStore ──────────────────────────────────────────────────────────────

describe('usageStore', () => {
  it('stores and returns a usage snapshot', () => {
    setUsage('generation', { used: 3, limit: 15, remaining: 12, tier: 'free', resetsAt: '' });
    expect(getUsage().generation).toEqual({ used: 3, limit: 15, remaining: 12, tier: 'free', resetsAt: '' });
    expect(getRemaining('generation')).toBe(12);
  });

  it('returns null remaining for an untracked kind', () => {
    expect(getRemaining('chat')).toBeNull();
  });

  it('setExhausted forces remaining to 0', () => {
    setExhausted('chat', { used: 5, limit: 5, tier: 'anonymous', resetsAt: '' });
    expect(getRemaining('chat')).toBe(0);
  });

  it('notifies subscribers on change', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    setUsage('generation', { used: 1, limit: 15, remaining: 14, tier: 'free', resetsAt: '' });
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    unsub();
    setUsage('generation', { used: 1, limit: 15, remaining: 14, tier: 'free', resetsAt: '' });
    expect(listener).not.toHaveBeenCalled();
  });
});

// ── quotaErrorFromBody ────────────────────────────────────────────────────────

describe('quotaErrorFromBody', () => {
  it('returns a QuotaExceededError for a quota_exceeded body', () => {
    const err = quotaErrorFromBody({
      error: 'quota_exceeded', kind: 'generation', used: 15, limit: 15, tier: 'free', resetsAt: '2026-06-02T00:00:00.000Z',
    });
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect(err?.kind).toBe('generation');
    expect(err?.limit).toBe(15);
    expect(err?.tier).toBe('free');
  });

  it('records the exhausted snapshot into the store', () => {
    quotaErrorFromBody({
      error: 'quota_exceeded', kind: 'chat', used: 5, limit: 5, tier: 'anonymous', resetsAt: '',
    });
    expect(getRemaining('chat')).toBe(0);
  });

  it('returns null for a non-quota body', () => {
    expect(quotaErrorFromBody({ error: 'Too many requests' })).toBeNull();
    expect(quotaErrorFromBody(undefined)).toBeNull();
    expect(quotaErrorFromBody({ answer: 'hi' })).toBeNull();
  });
});

// ── recordUsage ───────────────────────────────────────────────────────────────

describe('recordUsage', () => {
  it('writes a valid usage block into the store', () => {
    recordUsage({ kind: 'generation', used: 2, limit: 15, remaining: 13, tier: 'free', resetsAt: '' });
    expect(getRemaining('generation')).toBe(13);
  });

  it('derives remaining when omitted', () => {
    recordUsage({ kind: 'generation', used: 4, limit: 15, tier: 'free', resetsAt: '' });
    expect(getRemaining('generation')).toBe(11);
  });

  it('ignores malformed usage payloads', () => {
    recordUsage(undefined);
    recordUsage({ nope: true });
    expect(getRemaining('generation')).toBeNull();
  });
});

// ── quotaMessage ──────────────────────────────────────────────────────────────

describe('formatResetHint', () => {
  it('falls back to "tomorrow" when no timestamp', () => {
    expect(formatResetHint('')).toBe('tomorrow');
  });

  it('returns an hours hint for a near-future reset', () => {
    const inThreeHours = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    expect(formatResetHint(inThreeHours)).toMatch(/about 3 hours/);
  });

  it('handles an imminent reset', () => {
    const soon = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    expect(formatResetHint(soon)).toMatch(/less than an hour/);
  });
});

describe('formatQuotaMessage', () => {
  it('nudges anonymous users to sign in when possible', () => {
    const msg = formatQuotaMessage({ kind: 'generation', tier: 'anonymous', resetsAt: '', canSignIn: true });
    expect(msg).toMatch(/Sign in/i);
    expect(msg).toMatch(/creations/);
  });

  it('does not nudge signed-in users', () => {
    const msg = formatQuotaMessage({ kind: 'chat', tier: 'free', resetsAt: '', canSignIn: false });
    expect(msg).not.toMatch(/Sign in/i);
    expect(msg).toMatch(/questions/);
  });
});

describe('formatRemainingLabel', () => {
  it('singularises correctly', () => {
    expect(formatRemainingLabel('generation', 1)).toBe('1 creation left today');
    expect(formatRemainingLabel('chat', 1)).toBe('1 question left today');
  });

  it('pluralises correctly', () => {
    expect(formatRemainingLabel('generation', 3)).toBe('3 creations left today');
    expect(formatRemainingLabel('chat', 0)).toBe('0 questions left today');
  });
});
