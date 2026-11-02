import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({ default: () => null }));
const { verdict } = await import('./shell');

describe('verdict', () => {
  it.each([
    [5, 5, 'Perfect. You’ve got this one.'],
    [4, 5, 'Nearly flawless.'],
    [3, 5, 'Solid — the notes fill the gaps.'],
    [1, 5, 'Tricky one. Worth another go.'],
    [1, 1, 'Perfect. You’ve got this one.'],
    [0, 1, 'Tricky one. Worth another go.'],
  ])('%i/%i', (score, total, expected) => {
    expect(verdict(score, total)).toBe(expected);
  });
});
