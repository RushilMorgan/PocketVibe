/**
 * Splits text into overlapping chunks for embedding. Packs whole paragraphs
 * where possible; only hard-cuts a paragraph that is itself too long.
 */
export function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .flatMap((p) => hardSplit(p, size));

  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if (current && current.length + p.length + 1 > size) {
      chunks.push(current);
      current = tail(current, overlap);
    }
    current = current ? `${current} ${p}` : p;
  }
  if (current) chunks.push(current);
  return chunks;
}

function hardSplit(p: string, size: number): string[] {
  if (p.length <= size) return [p];
  const parts: string[] = [];
  for (let i = 0; i < p.length; i += size) parts.push(p.slice(i, i + size));
  return parts;
}

/** The last ~n characters, starting on a word boundary. */
function tail(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(-n);
  const space = cut.indexOf(' ');
  return space === -1 ? cut : cut.slice(space + 1);
}
