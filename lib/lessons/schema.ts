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

/** Phase 4 adds simulator | order | spot_bug to this union. */
export const lesson = quiz;
export type Lesson = Quiz;

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
