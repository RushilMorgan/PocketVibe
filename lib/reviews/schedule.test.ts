import { describe, expect, it } from 'vitest';
import { isDue, nextReviewLabel, reviewPlan, type ReviewLog } from './schedule';

const OPENED = '2026-11-01T10:00:00Z';
const r = (rating: ReviewLog['rating'], created_at: string, format: ReviewLog['format'] = 'recall'): ReviewLog => ({
  rating,
  format,
  created_at,
});
const plan = (reviews: ReviewLog[], over: { hasRelated?: boolean; isRecipe?: boolean; firstOpenedAt?: string | null } = {}) =>
  reviewPlan({ firstOpenedAt: OPENED, reviews, hasRelated: false, isRecipe: false, ...over });

describe('reviewPlan', () => {
  it('starts 3 days after first opening', () => {
    expect(plan([])).toEqual({ dueAt: '2026-11-04T10:00:00.000Z', step: 0, format: 'recall' });
  });

  it('moves on with Got it, repeats with Fuzzy, restarts with Forgot', () => {
    expect(plan([r('got', '2026-11-04T12:00:00Z')])).toMatchObject({ dueAt: '2026-11-14T12:00:00.000Z', step: 1 });
    expect(plan([r('got', '2026-11-04T12:00:00Z'), r('fuzzy', '2026-11-14T12:00:00Z')])).toMatchObject({
      dueAt: '2026-11-24T12:00:00.000Z',
      step: 1,
    });
    expect(plan([r('got', '2026-11-04T12:00:00Z'), r('forgot', '2026-11-14T12:00:00Z')])).toMatchObject({
      dueAt: '2026-11-17T12:00:00.000Z',
      step: 0,
    });
  });

  it('is done after the 30-day step', () => {
    expect(plan([r('got', '2026-11-04T12:00:00Z'), r('got', '2026-11-14T12:00:00Z'), r('got', '2026-12-14T12:00:00Z')])).toBeNull();
  });

  it('skips recipes and saves never opened', () => {
    expect(plan([], { isRecipe: true })).toBeNull();
    expect(plan([], { firstOpenedAt: null })).toBeNull();
  });

  it('uses Then and now for connected saves, alternating with recall', () => {
    expect(plan([], { hasRelated: true })?.format).toBe('connect');
    expect(plan([r('got', '2026-11-04T12:00:00Z', 'connect')], { hasRelated: true })?.format).toBe('recall');
    expect(
      plan([r('got', '2026-11-04T12:00:00Z', 'connect'), r('got', '2026-11-14T12:00:00Z', 'recall')], { hasRelated: true })?.format,
    ).toBe('connect');
  });

  it('orders reviews by time, whatever order they arrive in', () => {
    expect(plan([r('forgot', '2026-11-14T12:00:00Z'), r('got', '2026-11-04T12:00:00Z')])).toMatchObject({ step: 0 });
  });
});

describe('isDue and labels', () => {
  const p = plan([])!;
  it('is due once the time has come', () => {
    expect(isDue(p, new Date('2026-11-04T09:59:00Z'))).toBe(false);
    expect(isDue(p, new Date('2026-11-04T10:00:00Z'))).toBe(true);
    expect(isDue(null, new Date())).toBe(false);
  });

  it('says when the next check is', () => {
    expect(nextReviewLabel(p, new Date('2026-11-01T10:00:00Z'))).toBe('Next check: in 3 days.');
    expect(nextReviewLabel(p, new Date('2026-11-03T12:00:00Z'))).toBe('Next check: tomorrow.');
    expect(nextReviewLabel(null, new Date())).toBe("That's the last one — it's yours now.");
  });
});
