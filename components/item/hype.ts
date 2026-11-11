/**
 * The hype check usually reads "Hype: … Established: …". Split it so each half
 * gets its own label; anything else comes back as a single plain part.
 */
export type HypePart = { label: 'Hype' | 'Established' | null; text: string };

export function splitHype(text: string): HypePart[] {
  const re = /\b(Hype|Established)\s*:\s*/gi;
  const marks = [...text.matchAll(re)];
  if (marks.length === 0) return [{ label: null, text: text.trim() }];
  const parts: HypePart[] = [];
  const lead = text.slice(0, marks[0].index).trim();
  if (lead) parts.push({ label: null, text: lead });
  marks.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    const label = m[1].toLowerCase() === 'hype' ? 'Hype' : 'Established';
    if (body) parts.push({ label, text: body });
  });
  return parts;
}
