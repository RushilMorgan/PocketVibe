/**
 * "Help me shape it" — a short guided Q&A for users who freeze at the blank
 * textarea. Three plain questions; the answers are stitched into an editable
 * description client-side (no AI call, instant, free).
 */

export interface ShapeQuestion {
  id: 'what' | 'who' | 'why';
  question: string;
  hint: string;
  placeholder: string;
  optional: boolean;
}

export const SHAPE_QUESTIONS: ShapeQuestion[] = [
  {
    id: 'what',
    question: "What's it about, roughly?",
    hint: 'A few plain words is perfect — no need to polish.',
    placeholder: 'e.g. selling my banana bread, or whether to study further',
    optional: false,
  },
  {
    id: 'who',
    question: 'Who is it for — or who does it affect?',
    hint: "Skip this if you're not sure yet.",
    placeholder: 'e.g. busy parents, my neighbourhood, mostly just me',
    optional: true,
  },
  {
    id: 'why',
    question: 'What made you think about this now?',
    hint: 'The spark helps Toolie aim the board.',
    placeholder: 'e.g. friends keep asking me to make it for them',
    optional: true,
  },
];

function ensureSentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Stitch the guide answers into a natural description the user can still edit.
 * Answers keep the user's own casing — telling "Airbnb" apart from a stray
 * capital isn't worth mangling proper nouns over.
 */
export function composeIdeaDescription(answers: Partial<Record<ShapeQuestion['id'], string>>): string {
  const parts: string[] = [];
  const what = answers.what?.trim();
  const who = answers.who?.trim();
  const why = answers.why?.trim();
  if (what) parts.push(ensureSentence(what));
  if (who) parts.push(ensureSentence(`It's for ${who}`));
  if (why) parts.push(ensureSentence(`What got me thinking about it: ${why}`));
  return parts.join(' ');
}
