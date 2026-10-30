import { describe, expect, it } from 'vitest';
import { timeAgo } from './time-ago';

const now = Date.parse('2026-10-30T12:00:00Z');
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

describe('timeAgo', () => {
  it.each([
    [10, 'just now'],
    [5 * 60, '5 minutes ago'],
    [3 * 3600, '3 hours ago'],
    [86400, 'yesterday'],
    [9 * 86400, 'last week'],
  ])('%is → %s', (seconds, expected) => {
    expect(timeAgo(ago(seconds), now)).toBe(expected);
  });
});
