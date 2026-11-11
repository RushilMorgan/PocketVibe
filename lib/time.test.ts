import { describe, expect, it } from 'vitest';
import { DEFAULT_TZ, isValidTimeZone, localDate, localParts } from './time';

describe('time zones', () => {
  it('reads local date, time and weekday', () => {
    // Wed 11 Nov 2026 16:00 UTC
    const at = '2026-11-11T16:00:00Z';
    expect(localParts(at, 'Africa/Johannesburg')).toEqual({ date: '2026-11-11', hour: 18, minute: 0, weekday: 2 });
    expect(localParts(at, 'Europe/London')).toEqual({ date: '2026-11-11', hour: 16, minute: 0, weekday: 2 });
    expect(localParts(at, 'Asia/Tokyo')).toEqual({ date: '2026-11-12', hour: 1, minute: 0, weekday: 3 });
    expect(localParts(at, 'America/Los_Angeles')).toEqual({ date: '2026-11-11', hour: 8, minute: 0, weekday: 2 });
    expect(localParts(at, 'Asia/Kolkata')).toMatchObject({ hour: 21, minute: 30 });
  });

  it('handles daylight saving', () => {
    expect(localParts('2026-07-01T12:00:00Z', 'Europe/London').hour).toBe(13); // BST
    expect(localParts('2026-01-01T12:00:00Z', 'Europe/London').hour).toBe(12);
  });

  it('gives midnight as hour 0', () => {
    expect(localParts('2026-11-10T22:00:00Z', 'Africa/Johannesburg')).toMatchObject({ date: '2026-11-11', hour: 0 });
  });

  it('validates zones and falls back to the default for bad ones', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(localDate('2026-11-10T22:30:00Z', 'Mars/Olympus')).toBe(localDate('2026-11-10T22:30:00Z', DEFAULT_TZ));
    expect(localDate('2026-11-10T22:30:00Z')).toBe('2026-11-11');
  });
});
