import { beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ adminClient: () => ({ from: () => ({ insert }) }) }));

const { currentUsage, recordUsage, setUsageUser, withUsage } = await import('./usage');

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null });
});

const entry = { feature: 'explainer', provider: 'gemini', model: 'gemini-4-argon', inputTokens: 1_000_000, outputTokens: 0 } as const;

describe('usage scope', () => {
  it('nests: an inner scope adds the save, the outer keeps only the user', async () => {
    await withUsage({ userId: 'u1' }, async () => {
      await withUsage({ itemId: 'i1' }, async () => {
        await Promise.resolve();
        expect(currentUsage()).toEqual({ userId: 'u1', itemId: 'i1' });
      });
      expect(currentUsage()).toEqual({ userId: 'u1' });
    });
  });

  it("setUsageUser fills in the request's scope (how route() + requireUser() work)", async () => {
    await withUsage({}, async () => {
      await Promise.resolve();
      setUsageUser('u2');
      await Promise.resolve();
      expect(currentUsage().userId).toBe('u2');
    });
    expect(currentUsage()).toEqual({});
  });
});

describe('recordUsage', () => {
  it('logs the row with the estimated cost', async () => {
    await withUsage({ userId: 'u1', itemId: 'i1' }, () => recordUsage(entry));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', item_id: 'i1', feature: 'explainer', input_tokens: 1_000_000 }));
    expect(insert.mock.calls[0][0].cost_usd).toBeGreaterThan(0);
  });

  it('keeps a reported cost as is', async () => {
    await withUsage({ userId: 'u1' }, () => recordUsage({ ...entry, provider: 'openrouter', model: 'x/y', costUsd: 0.07 }));
    expect(insert.mock.calls[0][0]).toMatchObject({ cost_usd: 0.07, item_id: null });
  });

  it("skips a call with no user, and never throws when the insert fails", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await recordUsage(entry);
    expect(insert).not.toHaveBeenCalled();
    insert.mockResolvedValue({ error: new Error('down') });
    await expect(withUsage({ userId: 'u1' }, () => recordUsage(entry))).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });
});
