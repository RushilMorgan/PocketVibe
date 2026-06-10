import { describe, it, expect } from 'vitest';
import { mergeCloudIntoLocal } from '../lib/creationSync';
import type { Creation } from '../types';

function makeCreation(id: string, updatedAt: number, title = `t-${id}`): Creation {
  return {
    id,
    title,
    creationType: 'checklist',
    description: '',
    summary: '',
    originalRequest: '',
    status: 'ready',
    version: 1,
    createdAt: 0,
    updatedAt,
    content: { type: 'checklist', sections: [] },
  };
}

describe('mergeCloudIntoLocal', () => {
  it('adds cloud-only creations', () => {
    const local = [makeCreation('a', 100)];
    const cloud = [makeCreation('b', 50)];
    const merged = mergeCloudIntoLocal(local, cloud);
    expect(merged.map(c => c.id).sort()).toEqual(['a', 'b']);
  });

  it('keeps the local copy when it is newer (same object reference)', () => {
    const local = [makeCreation('a', 200, 'local-newer')];
    const cloud = [makeCreation('a', 100, 'cloud-older')];
    const merged = mergeCloudIntoLocal(local, cloud);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(local[0]); // reference equality = local won
    expect(merged[0].title).toBe('local-newer');
  });

  it('takes the cloud copy when it is newer', () => {
    const local = [makeCreation('a', 100, 'local-older')];
    const cloud = [makeCreation('a', 200, 'cloud-newer')];
    const merged = mergeCloudIntoLocal(local, cloud);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('cloud-newer');
  });

  it('handles empty cloud (fresh account) and empty local (new device)', () => {
    const local = [makeCreation('a', 1)];
    expect(mergeCloudIntoLocal(local, [])).toEqual(local);
    const cloud = [makeCreation('b', 1)];
    expect(mergeCloudIntoLocal([], cloud).map(c => c.id)).toEqual(['b']);
  });
});
