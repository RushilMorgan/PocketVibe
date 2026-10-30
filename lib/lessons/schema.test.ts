import { describe, expect, it } from 'vitest';
import { quiz, shuffleAnswers, type Quiz } from './schema';

const question = (n: number) => ({
  q: `Question ${n}?`,
  options: [`right ${n}`, `wrong a ${n}`, `wrong b ${n}`],
  answer: 0,
  why: 'Because.',
});

const valid: Quiz = {
  template: 'quiz',
  concept: 'Vector databases',
  intro: 'Two sentences. Here.',
  questions: [1, 2, 3, 4, 5].map(question),
  takeaway: 'Search by meaning, not words.',
};

describe('quiz schema', () => {
  it('accepts a valid quiz', () => {
    expect(quiz.safeParse(valid).success).toBe(true);
  });

  it('requires exactly 5 questions', () => {
    expect(quiz.safeParse({ ...valid, questions: valid.questions.slice(0, 4) }).success).toBe(false);
  });

  it('rejects an out-of-range answer', () => {
    const bad = { ...valid, questions: [{ ...question(1), answer: 3 }, ...valid.questions.slice(1)] };
    expect(quiz.safeParse(bad).success).toBe(false);
  });

  it('rejects duplicate options', () => {
    const bad = { ...valid, questions: [{ ...question(1), options: ['a', 'A ', 'b'] }, ...valid.questions.slice(1)] };
    expect(quiz.safeParse(bad).success).toBe(false);
  });
});

describe('shuffleAnswers', () => {
  it('keeps every answer pointing at the right option', () => {
    const shuffled = shuffleAnswers(valid, 42);
    shuffled.questions.forEach((q, i) => {
      expect(q.options[q.answer]).toBe(`right ${i + 1}`);
      expect([...q.options].sort()).toEqual([...valid.questions[i].options].sort());
    });
  });

  it('moves the answer out of slot 0 for at least some questions', () => {
    const positions = shuffleAnswers(valid, 7).questions.map((q) => q.answer);
    expect(positions.some((p) => p !== 0)).toBe(true);
  });

  it('is deterministic per seed', () => {
    expect(shuffleAnswers(valid, 99)).toEqual(shuffleAnswers(valid, 99));
  });
});
