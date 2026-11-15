/**
 * Running a save by the Council: the brief the chair gets. Pure and tested.
 * The council researches the web itself, so the brief carries what the save
 * says (its gist and an excerpt), not the whole page.
 */
export const DEFAULT_QUESTION = 'What should I make of this? Is it right, and does it matter?';
const EXCERPT_CHARS = 3500;
export const QUESTION_MAX = 600;

export interface SaveForCouncil {
  title: string | null;
  url: string;
  kind: string | null;
  /** The explainer's lines, or the recipe's description. */
  gist: string[];
  whyItMatters?: string | null;
  /** The text that was read from the page or video. */
  text: string | null;
}

/** One line, trimmed; the default when nothing was typed. */
export function cleanQuestion(raw: string | null | undefined): string {
  const q = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, QUESTION_MAX);
  return q || DEFAULT_QUESTION;
}

export function saveBrief(question: string | null | undefined, save: SaveForCouncil): string {
  const excerpt = (save.text ?? '').replace(/\s+\n/g, '\n').trim();
  const cut = excerpt.length > EXCERPT_CHARS ? `${excerpt.slice(0, EXCERPT_CHARS).trimEnd()}…` : excerpt;
  return [
    cleanQuestion(question),
    `This is about something I saved${save.kind ? ` (${save.kind})` : ''}: ${save.title ? `“${save.title}”` : 'untitled'}\n${save.url}`,
    save.gist.length ? `What it says, in short:\n${save.gist.map((l) => `- ${l}`).join('\n')}` : '',
    save.whyItMatters ? `Why it's said to matter: ${save.whyItMatters}` : '',
    cut ? `From the source itself:\n${cut}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
