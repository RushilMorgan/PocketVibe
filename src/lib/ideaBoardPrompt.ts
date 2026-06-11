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

export interface IdeaIntent {
  id: string;
  label: string;
  emoji: string;
  description: string;
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
 * What the user wants to get out of the board. This drives the AI's entire
 * framing — a "learn / explore" intent should never produce a business pitch.
 */
export const IDEA_INTENTS: IdeaIntent[] = [
  { id: 'validate',  label: 'Validate an idea',         emoji: '🚀', description: 'Is this worth pursuing?' },
  { id: 'learn',     label: 'Learn or explore a topic', emoji: '📚', description: 'Understand it deeply' },
  { id: 'compare',   label: 'Compare options',          emoji: '⚖️', description: 'Pick between approaches' },
  { id: 'brainstorm',label: 'Brainstorm freely',        emoji: '🧠', description: 'Open-ended thinking' },
  { id: 'decide',    label: 'Make a decision',          emoji: '🎯', description: 'Think through a choice' },
];

/**
 * Build a generation prompt that matches the user's actual intent — not
 * everything is a business idea. The intent drives the entire framing so
 * "LangGraph vs LangChain" produces a comparison/learning board, not a pitch.
 */
export function buildIdeaBoardPrompt(categoryLabel: string, idea: string, intentId = 'validate'): string {
  const desc = idea.trim();
  const cat  = categoryLabel.trim();

  const subject = cat && desc ? `${cat.toLowerCase()}: "${desc}"` : desc || cat || 'an idea I want to explore';

  switch (intentId) {
    case 'learn':
      return [
        `I want to understand and explore: "${desc}".`,
        `Build me a learning exploration board — NOT a business pitch. I want to understand this topic deeply.`,
        `Include: what it is and why it matters (plain language, no jargon), the key concepts I need to understand,`,
        `how it compares to related alternatives or approaches, real-world examples and use cases,`,
        `honest hard truths and common misconceptions, what I would need to learn or do to get started,`,
        `a visual mind map of the topic, and concrete first steps to deepen my understanding.`,
        `Make it feel like a smart friend explaining the topic clearly, not a business consultant.`,
      ].join(' ');

    case 'compare':
      return [
        `I want to compare and understand the differences between: "${desc}".`,
        `Build me a comparison thinking board — NOT a business pitch.`,
        `Include: a clear explanation of each option/approach, the key differences between them,`,
        `what each one is good at and where it falls short, when you'd choose one over the other,`,
        `real-world use cases for each, common mistakes or misconceptions about each,`,
        `a visual mind map showing how they relate, and a clear "when to use which" recommendation.`,
        `Be specific and concrete — no generic pros/cons lists. Make it genuinely useful for someone deciding.`,
      ].join(' ');

    case 'brainstorm':
      return [
        `I want to brainstorm around: "${desc}".`,
        `Build me a creative thinking board that helps me explore this broadly and openly.`,
        `Include: different angles and interpretations of the idea, wild/ambitious and practical possibilities,`,
        `what makes this interesting or worth exploring, unexpected connections or combinations,`,
        `potential obstacles and creative ways around them, who else this could be relevant for,`,
        `a visual mind map of the idea space, and a range of next directions (from safe to bold).`,
        `Keep it creative and expansive — this is about generating possibilities, not validating one.`,
      ].join(' ');

    case 'decide':
      return [
        `I need to think through a decision about: "${desc}".`,
        `Build me a decision-making board that helps me think this through clearly and honestly.`,
        `Include: what I'm actually choosing between (make this concrete), the key factors that matter most,`,
        `what I'd be gaining and giving up with each path, the risks and unknowns I should face honestly,`,
        `what logic says vs what gut says, who this decision affects and how,`,
        `a visual mind map of the decision space, and concrete next steps to help me commit.`,
        `Be honest and personal — help me think, not sell me on a direction.`,
      ].join(' ');

    default: // 'validate' — business/product viability (original behaviour)
      return [
        `I want to think through ${subject}.`,
        `Build me an Idea Thinking Board that helps me really explore it — not a to-do list.`,
        `Include: a clear idea summary, the real problem it solves, my solution, who exactly it's for,`,
        `honest risks and hard truths (name real competitors or things people already do for free),`,
        `realistic ways it could make money with specific prices, an honest idea-health score,`,
        `a visual mind map of the idea, and concrete next steps I can test this week before building.`,
        // The risk/opportunity titles double as a SWOT grid — keep them crisp
        `Write each risk and opportunity title as a crisp, specific one-liner (they're shown on a SWOT-style grid).`,
        // Lean-validation ordering: cheapest reality check first
        `Order the next steps as a validation ladder: talking to real potential users first, then the smallest cheapest test, then the first build step — never start with building.`,
        `Be specific and insightful about THIS idea — make it feel genuinely useful, not generic.`,
      ].join(' ');
  }
}
