import { describe, expect, it } from 'vitest';
import { lesson, maxScore, order, quiz, shuffleAnswers, shuffledOrder, simulator, spotBug, type Quiz } from './schema';

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

const sim = {
  template: 'simulator' as const,
  concept: 'How an API call works',
  intro: 'Every app talks to servers. Here is one round trip.',
  nodes: [
    { id: 'app', label: 'Your app' },
    { id: 'api', label: 'API server' },
    { id: 'db', label: 'Database' },
  ],
  states: [
    { label: 'Tap send', happening: 'The app builds a request.', highlight: 'app' },
    { label: 'Request arrives', happening: 'The server checks it.', highlight: 'api' },
    { label: 'Data fetched', happening: 'The database finds the rows.', highlight: 'db' },
    { label: 'Reply sent', happening: 'The server answers with JSON.', highlight: 'api' },
  ],
  takeaway: 'An API is a waiter between your app and the kitchen.',
};

describe('simulator schema', () => {
  it('accepts a valid simulator', () => {
    expect(simulator.safeParse(sim).success).toBe(true);
  });

  it('rejects a state highlighting a node that does not exist', () => {
    const bad = { ...sim, states: [...sim.states.slice(0, 3), { ...sim.states[3], highlight: 'cache' }] };
    expect(simulator.safeParse(bad).success).toBe(false);
  });
});

const ord = {
  template: 'order' as const,
  concept: 'Making a git commit',
  intro: 'Commits are snapshots. The order matters.',
  steps: ['Edit files', 'git add', 'git commit', 'git push', 'Open a PR'].map((text) => ({ text, why: 'Because.' })),
  takeaway: 'Stage, commit, push.',
};

describe('order schema', () => {
  it('accepts 5–7 distinct steps', () => {
    expect(order.safeParse(ord).success).toBe(true);
    expect(order.safeParse({ ...ord, steps: ord.steps.slice(0, 4) }).success).toBe(false);
  });

  it('rejects duplicate steps', () => {
    expect(order.safeParse({ ...ord, steps: [...ord.steps.slice(0, 4), ord.steps[0]] }).success).toBe(false);
  });
});

const bug = {
  template: 'spot_bug' as const,
  concept: 'Off-by-one errors',
  intro: 'Loops love to run one time too many.',
  language: 'python',
  code: ['items = [1, 2, 3]', 'total = 0', 'for i in range(len(items) + 1):', '    total += items[i]', 'print(total)', '# done'],
  bug_line: 2,
  why: 'range goes one past the last index.',
  fix: 'for i in range(len(items)):',
  takeaway: 'range(len(x)) already stops at the last index.',
};

describe('spot_bug schema', () => {
  it('accepts a valid bug', () => {
    expect(spotBug.safeParse(bug).success).toBe(true);
  });

  it('rejects a bug_line past the end and a no-op fix', () => {
    expect(spotBug.safeParse({ ...bug, bug_line: 6 }).success).toBe(false);
    expect(spotBug.safeParse({ ...bug, fix: bug.code[2] }).success).toBe(false);
  });
});

describe('lesson union + maxScore', () => {
  it('parses every template through the union', () => {
    for (const l of [valid, sim, ord, bug]) expect(lesson.safeParse(l).success).toBe(true);
  });

  it('scores per template', () => {
    expect([valid, sim, ord, bug].map((l) => maxScore(lesson.parse(l)))).toEqual([5, 1, 5, 1]);
  });
});

describe('shuffledOrder', () => {
  it('is a permutation with at least half the steps out of place', () => {
    for (const length of [5, 6, 7]) {
      for (let seed = 1; seed < 50; seed++) {
        const o = shuffledOrder(length, seed);
        expect([...o].sort()).toEqual(Array.from({ length }, (_, i) => i));
        expect(o.filter((v, i) => v !== i).length).toBeGreaterThanOrEqual(Math.ceil(length / 2));
      }
    }
  });
});
