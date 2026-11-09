import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { dedupeCitations, extractJson } from '@/lib/ai/openrouter';
import { needsRevision, numberSources, othersText, splitQuestions, tally } from './format';
import { rosterFrom, DEFAULT_ROSTER } from './roster';
import type { MemberVote, Take } from './schemas';

const take = (summary: string): Take => ({
  stance: 'refine',
  confidence: 3,
  summary,
  sections: [],
  strengths: [],
  risks: [],
  next_steps: [],
});

const vote = (member: string, v: MemberVote['vote']): MemberVote => ({ member, vote: v, notes: '', changes: [] });

describe('council format', () => {
  it('splits questions round-robin and drops empty sets', () => {
    expect(splitQuestions(['a', 'b', 'c'], 2)).toEqual([['a', 'c'], ['b']]);
    expect(splitQuestions(['a'], 2)).toEqual([['a']]);
  });

  it('numbers sources across briefs, first appearance wins', () => {
    const sources = numberSources([
      [{ url: 'https://a.com/x', title: 'A' }],
      [
        { url: 'https://a.com/x', title: 'A again' },
        { url: 'https://b.com/y', title: '' },
      ],
    ]);
    expect(sources).toEqual([
      { n: 1, url: 'https://a.com/x', title: 'A' },
      { n: 2, url: 'https://b.com/y', title: 'b.com' },
    ]);
  });

  it('shows other members by letter, never by seat or model', () => {
    const text = othersText({ skeptic: take('no way'), builder: take('easy'), market: take('people want it') }, 'builder');
    expect(text).toContain('Member A');
    expect(text).toContain('Member C');
    expect(text).not.toContain('easy');
    expect(text).not.toMatch(/skeptic|market|gpt|grok/i);
  });

  it('revises unless everyone agrees outright', () => {
    expect(needsRevision([vote('a', 'agree'), vote('b', 'agree')])).toBe(false);
    expect(needsRevision([vote('a', 'agree'), vote('b', 'agree_with_changes')])).toBe(true);
    expect(tally([vote('a', 'agree'), vote('b', 'dissent'), vote('c', 'dissent')])).toEqual({
      agree: 1,
      agree_with_changes: 0,
      dissent: 2,
    });
  });
});

describe('council roster', () => {
  it('applies COUNCIL_MODELS overrides and ignores junk', () => {
    expect(rosterFrom('{"chair":"anthropic/claude-sonnet-5.5"}').chair.model).toBe('anthropic/claude-sonnet-5.5');
    expect(rosterFrom('{"chair":"anthropic/claude-sonnet-5.5"}').skeptic.model).toBe(DEFAULT_ROSTER.skeptic.model);
    expect(rosterFrom('not json').chair.model).toBe(DEFAULT_ROSTER.chair.model);
    expect(rosterFrom(undefined).market.model).toBe(DEFAULT_ROSTER.market.model);
  });
});

describe('openrouter parsing', () => {
  it('extracts JSON from fences and prose', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":{"b":2}} hope that helps')).toEqual({ a: { b: 2 } });
    expect(extractJson('nope')).toBeUndefined();
  });

  it('dedupes citations keeping the first title, http(s) only', () => {
    expect(
      dedupeCitations([
        { url: 'https://a.com', title: 'first' },
        { url: 'https://a.com', title: 'second' },
        { url: 'javascript:alert(1)', title: 'x' },
      ]),
    ).toEqual([{ url: 'https://a.com', title: 'first' }]);
  });
});

describe('council schemas', () => {
  it('all convert to JSON Schema for structured output', async () => {
    const { z } = await import('zod');
    const s = await import('./schemas');
    for (const schema of [s.frameSchema, s.takeSchema, s.rebuttalSchema, s.draftSchema, s.voteSchema, s.followupTakeSchema, s.followupAnswerSchema]) {
      expect(() => z.toJSONSchema(schema)).not.toThrow();
    }
  });
});
