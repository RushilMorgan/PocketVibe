/**
 * Idea Thinking Board — guided intake.
 *
 * The Idea Board is different from the other flagship tools: it can't be
 * auto-generated from nothing because it needs the user's actual idea. So the
 * card opens a short intake (what kind of idea + a one-line description), and we
 * compose a rich, specific prompt here before generating. The prompt is paired
 * with forcedType: 'idea_thinking_board' so the result is always the real board.
 */

export interface IdeaCategory {
  id: string;
  label: string;
  emoji: string;
}

export const IDEA_CATEGORIES: IdeaCategory[] = [
  { id: 'business',    label: 'Business idea',    emoji: '💼' },
  { id: 'app',         label: 'App or tech',      emoji: '📱' },
  { id: 'side-hustle', label: 'Side hustle',      emoji: '💸' },
  { id: 'product',     label: 'A product',        emoji: '📦' },
  { id: 'service',     label: 'A service',        emoji: '🤝' },
  { id: 'event',       label: 'Event or party',   emoji: '🎉' },
  { id: 'creative',    label: 'Creative project', emoji: '🎨' },
  { id: 'other',       label: 'Something else',   emoji: '✨' },
];

/**
 * Build a detailed generation prompt from the user's intake answers.
 * `categoryLabel` is the human label (e.g. "Side hustle"); `idea` is their
 * free-text description. Either may be empty — the prompt degrades gracefully.
 */
export function buildIdeaBoardPrompt(categoryLabel: string, idea: string): string {
  const cat = categoryLabel.trim();
  const desc = idea.trim();

  const subject = cat && desc
    ? `a ${cat.toLowerCase()}: "${desc}"`
    : desc
      ? `this idea: "${desc}"`
      : cat
        ? `a ${cat.toLowerCase()} I'm still shaping`
        : 'an idea I want to explore';

  return [
    `I want to think through ${subject}.`,
    `Build me an Idea Thinking Board that helps me really explore it — not a to-do list.`,
    `Include: a clear idea summary, the real problem it solves, my solution, who exactly it's for,`,
    `honest risks and hard truths (name real competitors or things people already do for free),`,
    `realistic ways it could make money with specific prices, an honest idea-health score,`,
    `a visual mind map of the idea, and concrete next steps I can test this week before building.`,
    `Be specific and insightful about THIS idea — make it feel genuinely useful, not generic.`,
  ].join(' ');
}
