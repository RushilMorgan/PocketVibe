import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { diversify, interleave, splitQuestion } = await import('./chat');

describe('splitQuestion', () => {
  it('splits a compound question into its clauses', () => {
    expect(splitQuestion('How does RAG use a vector database, and what do I need for pancakes?')).toEqual([
      'How does RAG use a vector database',
      'what do I need for pancakes',
    ]);
  });

  it('splits multiple questions', () => {
    expect(splitQuestion('What is an embedding? Why do LLMs need them?')).toEqual([
      'What is an embedding',
      'Why do LLMs need them',
    ]);
  });

  it('leaves a simple question (even with "and") alone', () => {
    expect(splitQuestion('What is the difference between RAG and fine-tuning?')).toEqual([]);
    expect(splitQuestion('pancakes?')).toEqual([]);
  });
});

describe('interleave', () => {
  it('alternates between lists and drops repeats', () => {
    const a = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const b = [{ id: '9' }, { id: '1' }];
    expect(interleave([a, b]).map((c) => c.id)).toEqual(['1', '9', '2', '3']);
  });
});

describe('diversify', () => {
  const ranked = [
    ...Array.from({ length: 10 }, (_, i) => ({ item_id: 'long-article', n: i })),
    { item_id: 'recipe', n: 10 },
    { item_id: 'recipe', n: 11 },
    { item_id: 'video', n: 12 },
  ];

  it('caps chunks per item so other saves get a slot', () => {
    const picked = diversify(ranked, 8, 3);
    expect(picked.filter((c) => c.item_id === 'long-article')).toHaveLength(3);
    expect(picked.map((c) => c.item_id)).toContain('recipe');
    expect(picked.map((c) => c.item_id)).toContain('video');
  });

  it('keeps best-first order and stops at the limit', () => {
    const picked = diversify(ranked, 4, 3);
    expect(picked.map((c) => c.n)).toEqual([0, 1, 2, 10]);
  });
});
