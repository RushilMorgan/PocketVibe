import { describe, it, expect } from 'vitest';
import { mergeThings, type CloudTool } from '../lib/mergeThings';
import type { Creation } from '../types';

function makeLocal(overrides: Partial<Creation> = {}): Creation {
  return {
    id: 'c1',
    title: 'Local thing',
    creationType: 'checklist',
    description: '',
    summary: '',
    originalRequest: '',
    status: 'ready',
    version: 1,
    createdAt: 0,
    updatedAt: 1000,
    content: { type: 'checklist', sections: [] },
    ...overrides,
  };
}

function makeCloud(overrides: Partial<CloudTool> = {}): CloudTool {
  return {
    id: 'cloud-1',
    share_slug: 'slug1',
    title: 'Cloud thing',
    creation_type: 'tournament_pool_tracker',
    created_at: '2026-05-30T00:00:00Z',
    updated_at: '2026-05-30T00:00:00Z',
    public_view: true,
    ...overrides,
  };
}

describe('mergeThings', () => {
  it('returns only local creations when there are no cloud tools', () => {
    const result = mergeThings([makeLocal()], []);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('local');
  });

  it('returns only cloud tools when there are no local creations', () => {
    const result = mergeThings([], [makeCloud()]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('cloud');
  });

  it('de-dupes a cloud tool that matches a local creation by shareSlug', () => {
    const local = makeLocal({ shareSlug: 'slug1' });
    const cloud = makeCloud({ share_slug: 'slug1' });
    const result = mergeThings([local], [cloud]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('local');
  });

  it('keeps a cloud tool that has no local counterpart', () => {
    const local = makeLocal({ shareSlug: 'slug1' });
    const cloudMatch = makeCloud({ id: 'a', share_slug: 'slug1' });
    const cloudOnly = makeCloud({ id: 'b', share_slug: 'slug2', title: 'Cloud only' });
    const result = mergeThings([local], [cloudMatch, cloudOnly]);
    expect(result).toHaveLength(2);
    const cloudKinds = result.filter(r => r.kind === 'cloud');
    expect(cloudKinds).toHaveLength(1);
    expect(cloudKinds[0].kind === 'cloud' && cloudKinds[0].tool.share_slug).toBe('slug2');
  });

  it('sorts merged results newest-first across local and cloud', () => {
    const oldLocal = makeLocal({ id: 'old', updatedAt: 1000 });
    const newCloud = makeCloud({ id: 'new', share_slug: 's', updated_at: '2030-01-01T00:00:00Z' });
    const result = mergeThings([oldLocal], [newCloud]);
    expect(result[0].kind).toBe('cloud');
    expect(result[1].kind).toBe('local');
  });

  it('does not de-dupe local creations that have no shareSlug', () => {
    const result = mergeThings([makeLocal({ shareSlug: undefined })], [makeCloud({ share_slug: 'slug1' })]);
    expect(result).toHaveLength(2);
  });
});
