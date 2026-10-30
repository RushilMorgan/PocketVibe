import { describe, expect, it } from 'vitest';
import { chunkText } from './chunk';

describe('chunkText', () => {
  it('keeps short text as one chunk', () => {
    expect(chunkText('One para.\n\nTwo para.')).toEqual(['One para. Two para.']);
  });

  it('never exceeds size plus one paragraph of overlap', () => {
    const para = 'word '.repeat(60).trim(); // 299 chars
    const chunks = chunkText(Array(20).fill(para).join('\n\n'), 1000, 150);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000 + 150);
  });

  it('overlaps consecutive chunks', () => {
    const paras = Array.from({ length: 10 }, (_, i) => `Paragraph number ${i} ${'x'.repeat(200)}`);
    const [first, second] = chunkText(paras.join('\n\n'), 500, 100);
    expect(first.includes(second.slice(0, 40))).toBe(true);
  });

  it('hard-splits a single giant paragraph', () => {
    expect(chunkText('a'.repeat(2500), 1000, 0)).toHaveLength(3);
  });

  it('returns nothing for blank text', () => {
    expect(chunkText('  \n\n ')).toEqual([]);
  });
});
