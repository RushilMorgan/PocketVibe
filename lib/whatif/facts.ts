/**
 * Today's facts for a what-if, from a Search-grounded answer. Pure, so it's
 * tested: a line of the answer becomes a fact only if Search backed some of it,
 * and it keeps the sources that did. Lines Search didn't back are dropped, so
 * the card's "Today" part never shows something the model made up.
 */
import type { GroundingSupport } from '@/lib/ai/gemini';

export interface GroundedFact {
  text: string;
  /** Indexes into the grounded call's `sources`. */
  sources: number[];
}

const MAX_FACTS = 8;
const MAX_SOURCES_PER_FACT = 2;

/** "- **Toyota** plans…" → "Toyota plans…". */
function cleanLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function groundedFacts(text: string, supports: GroundingSupport[]): GroundedFact[] {
  const facts: GroundedFact[] = [];
  for (const raw of text.split('\n')) {
    if (facts.length >= MAX_FACTS) break;
    const sources = new Set<number>();
    for (const s of supports) {
      const segment = s.text.trim();
      if (segment && raw.includes(segment)) for (const i of s.sources) sources.add(i);
    }
    const line = cleanLine(raw);
    if (line.length < 12 || !sources.size) continue;
    facts.push({ text: line, sources: [...sources].slice(0, MAX_SOURCES_PER_FACT) });
  }
  return facts;
}

/** The facts as the smart model sees them: "[1] …". */
export function numberedFacts(facts: GroundedFact[]): string {
  return facts.length ? facts.map((f, i) => `[${i + 1}] ${f.text}`).join('\n') : '(Search found nothing solid — leave "today" empty.)';
}
