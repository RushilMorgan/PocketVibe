import { describe, expect, it } from 'vitest';
import { fillTemplate } from './template';

describe('fillTemplate', () => {
  it('fills every placeholder', () => {
    expect(fillTemplate('Level: {level}. Into: {top_topics}.', { level: 'dev', top_topics: 'RAG, sourdough' })).toBe(
      'Level: dev. Into: RAG, sourdough.',
    );
  });

  it('leaves JSON braces alone', () => {
    expect(fillTemplate('{"kind": "x"} {level}', { level: 'dev' })).toBe('{"kind": "x"} dev');
  });

  it('throws on a placeholder with no value', () => {
    expect(() => fillTemplate('{top_topcs}', {})).toThrow('{top_topcs}');
  });
});
