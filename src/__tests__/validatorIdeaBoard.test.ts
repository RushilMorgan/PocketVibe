/**
 * Regression tests: the validator must accept idea_thinking_board responses.
 * (A missing entry here caused valid boards to be rejected as "unsupported"
 * and fall back to an empty checklist in error state.)
 */
import { describe, it, expect } from 'vitest';
import { validateGenerateResponse, coerceGenerateResponse, SUPPORTED_TYPES } from '../lib/validator';

function fullBoardResponse() {
  return {
    title: 'Personal Assistant App',
    creationType: 'idea_thinking_board',
    description: 'An idea board for a personal assistant app',
    summary: 'Here is your idea board.',
    content: {
      type: 'idea_thinking_board',
      title: 'Personal Assistant App',
      ideaSummary: 'An app that helps busy people manage their day.',
      problem: 'People juggle too many apps.',
      solution: 'One assistant that ties them together.',
      targetUsers: [{ id: 'u1', name: 'Busy pros', need: 'Less admin', whyTheyCare: 'No time' }],
      risks: [{ id: 'r1', title: 'Big competitors', severity: 'high', note: 'Siri, Google exist' }],
      opportunities: [{ id: 'o1', title: 'Niche focus', note: 'Underserved group' }],
      moneyIdeas: [{ id: 'm1', model: 'Subscription', note: 'R49/month', confidence: 6 }],
      scores: { clarity: 7, usefulness: 8, easeToBuild: 4, moneyPotential: 6, riskLevel: 7, confidence: 6 },
      nextSteps: [{ id: 'n1', label: 'Talk to 5 people', done: false }],
      visualMap: { center: 'Assistant App', branches: [{ id: 'b1', label: 'Problem', items: ['Too many apps'] }] },
      notes: '',
    },
  };
}

describe('validator — idea_thinking_board', () => {
  it('idea_thinking_board is in SUPPORTED_TYPES', () => {
    expect(SUPPORTED_TYPES.has('idea_thinking_board')).toBe(true);
  });

  it('accepts a complete idea board response', () => {
    const result = validateGenerateResponse(fullBoardResponse());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a partial board after coercion fills defaults', () => {
    const partial = fullBoardResponse();
    // Simulate the AI omitting several fields
    delete (partial.content as Record<string, unknown>).risks;
    delete (partial.content as Record<string, unknown>).moneyIdeas;
    delete (partial.content as Record<string, unknown>).scores;
    delete (partial.content as Record<string, unknown>).visualMap;
    coerceGenerateResponse(partial as Record<string, unknown>);
    const result = validateGenerateResponse(partial);
    expect(result.valid).toBe(true);
  });

  it('coercion fills missing arrays, scores, and visualMap', () => {
    const partial = fullBoardResponse();
    const c = partial.content as Record<string, unknown>;
    delete c.risks;
    delete c.scores;
    delete c.visualMap;
    coerceGenerateResponse(partial as Record<string, unknown>);
    expect(Array.isArray((partial.content as any).risks)).toBe(true);
    expect((partial.content as any).scores.clarity).toBeGreaterThanOrEqual(1);
    expect((partial.content as any).scores.clarity).toBeLessThanOrEqual(10);
    expect(Array.isArray((partial.content as any).visualMap.branches)).toBe(true);
  });

  it('coercion clamps out-of-range scores into 1–10', () => {
    const partial = fullBoardResponse();
    (partial.content as any).scores = { clarity: 99, usefulness: -3, easeToBuild: 5, moneyPotential: 5, riskLevel: 5, confidence: 5 };
    coerceGenerateResponse(partial as Record<string, unknown>);
    expect((partial.content as any).scores.clarity).toBe(10);
    expect((partial.content as any).scores.usefulness).toBe(1);
  });
});
