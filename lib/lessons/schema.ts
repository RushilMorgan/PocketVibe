import { z } from 'zod';

/**
 * Lesson content (item_outputs.content, type 'lesson'). The AI writes only
 * this JSON; a fixed React template per `template` renders it. Client-safe.
 */

export const quizQuestion = z
  .object({
    q: z.string().min(1).max(200),
    options: z.array(z.string().min(1).max(120)).length(3),
    answer: z.number().int().min(0).max(2).describe('Index of the correct option'),
    why: z.string().min(1).max(300).describe('1–2 sentences on why the answer is right'),
  })
  .refine((q) => new Set(q.options.map((o) => o.trim().toLowerCase())).size === 3, {
    message: 'Options must be different',
  });

export const quiz = z.object({
  template: z.literal('quiz'),
  concept: z.string().min(1).max(120),
  intro: z.string().min(1).max(400).describe('2-sentence hook in plain words'),
  questions: z.array(quizQuestion).length(5),
  takeaway: z.string().min(1).max(200),
});

export type Quiz = z.infer<typeof quiz>;
export type QuizQuestion = z.infer<typeof quizQuestion>;

/** How a system works: step through states, watching the active part light up. */
export const simulator = z
  .object({
    template: z.literal('simulator'),
    concept: z.string().min(1).max(120),
    intro: z.string().min(1).max(400),
    nodes: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9_]{1,24}$/).describe('Short slug, e.g. "api"'),
          label: z.string().min(1).max(40).describe('Max 4 words'),
        }),
      )
      .min(3)
      .max(8)
      .describe('The parts of the system, in the order data/work flows through them'),
    states: z
      .array(
        z.object({
          label: z.string().min(1).max(60).describe('Max 6 words'),
          happening: z.string().min(1).max(300).describe("1–2 sentences: what's happening now"),
          highlight: z.string().describe('The id of the node that is active in this state'),
        }),
      )
      .min(4)
      .max(6),
    takeaway: z.string().min(1).max(200),
  })
  .refine((s) => new Set(s.nodes.map((n) => n.id)).size === s.nodes.length, { message: 'Node ids must be unique' })
  .refine((s) => s.states.every((st) => s.nodes.some((n) => n.id === st.highlight)), {
    message: 'Every state must highlight an existing node id',
  });

/** Processes and pipelines: put the steps in order. Steps are stored correct. */
export const order = z
  .object({
    template: z.literal('order'),
    concept: z.string().min(1).max(120),
    intro: z.string().min(1).max(400),
    steps: z
      .array(
        z.object({
          text: z.string().min(1).max(90).describe('The step, short enough for one or two lines'),
          why: z.string().min(1).max(200).describe('Why it comes at this point'),
        }),
      )
      .min(5)
      .max(7)
      .describe('In the CORRECT order'),
    takeaway: z.string().min(1).max(200),
  })
  .refine((o) => new Set(o.steps.map((s) => s.text.trim().toLowerCase())).size === o.steps.length, {
    message: 'Steps must be different',
  });

/** Code concepts: tap the broken line. */
export const spotBug = z
  .object({
    template: z.literal('spot_bug'),
    concept: z.string().min(1).max(120),
    intro: z.string().min(1).max(400),
    language: z.string().min(1).max(20).describe('e.g. "python", "javascript", "sql"'),
    code: z.array(z.string().max(80)).min(6).max(12).describe('One entry per line, indentation kept'),
    bug_line: z.number().int().min(0).describe('0-based index into code of the one broken line'),
    why: z.string().min(1).max(300).describe("Why that line is wrong, in plain words"),
    fix: z.string().min(1).max(80).describe('The corrected line'),
    takeaway: z.string().min(1).max(200),
  })
  .refine((b) => b.bug_line < b.code.length, { message: 'bug_line must point at a line of code' })
  .refine((b) => b.code[b.bug_line]?.trim() !== b.fix.trim(), { message: 'fix must change the broken line' });

export type Simulator = z.infer<typeof simulator>;
export type Order = z.infer<typeof order>;
export type SpotBug = z.infer<typeof spotBug>;

export const TEMPLATES = ['quiz', 'simulator', 'order', 'spot_bug'] as const;
export type Template = (typeof TEMPLATES)[number];

export const TEMPLATE_LABEL: Record<Template, string> = {
  quiz: 'Quiz',
  simulator: 'Simulator',
  order: 'Put in order',
  spot_bug: 'Spot the bug',
};

/** One schema per template; the AI is only ever asked for one at a time. */
export const templateSchema = { quiz, simulator, order, spot_bug: spotBug } as const;

export const lesson = z.discriminatedUnion('template', [quiz, simulator, order, spotBug]);
export type Lesson = z.infer<typeof lesson>;

/** The best possible score, so results from every template compare as a fraction. */
export function maxScore(l: Lesson): number {
  switch (l.template) {
    case 'quiz':
      return l.questions.length;
    case 'order':
      return l.steps.length;
    case 'spot_bug':
    case 'simulator': // Completion only — there's nothing to get wrong.
      return 1;
  }
}

/**
 * Order players: steps shuffled so at least half start out of place — a
 * puzzle that's nearly solved on arrival teaches nothing.
 */
export function shuffledOrder(length: number, seed: number): number[] {
  let state = seed >>> 0 || 1;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const need = Math.ceil(length / 2);
  for (let tries = 0; tries < 50; tries++) {
    const order = Array.from({ length }, (_, i) => i);
    for (let i = length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.filter((v, i) => v !== i).length >= need) return order;
  }
  return Array.from({ length }, (_, i) => length - 1 - i);
}

/**
 * Models put the right answer in the same slot far too often. Shuffle each
 * question's options (deterministically from `seed`) and remap `answer`.
 */
export function shuffleAnswers(input: Quiz, seed: number): Quiz {
  let state = seed >>> 0 || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  return {
    ...input,
    questions: input.questions.map((question) => {
      const order = [0, 1, 2];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      return { ...question, options: order.map((i) => question.options[i]), answer: order.indexOf(question.answer) };
    }),
  };
}
