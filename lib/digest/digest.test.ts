import { describe, expect, it } from 'vitest';
import { renderDigestEmail } from './email';
import { digestContent, extractJsonArray, groupByTopic, weekStart, type DigestContent } from './schema';

describe('weekStart', () => {
  it('is the Monday of the SAST week', () => {
    // Sunday 18:00 SAST = 16:00 UTC → still the week that began Monday 26 Oct.
    expect(weekStart(new Date('2026-11-01T16:00:00Z'))).toBe('2026-10-26');
    // Sunday 23:30 UTC is already Monday 01:30 SAST → new week.
    expect(weekStart(new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02');
  });
});

describe('groupByTopic', () => {
  const topics: Record<string, { name: string; weight: number }[]> = {
    a: [
      { name: 'rag', weight: 5 },
      { name: 'ai', weight: 9 },
    ],
    b: [{ name: 'ai', weight: 9 }],
    c: [{ name: 'sourdough', weight: 2 }],
    d: [],
  };
  const groups = groupByTopic(['a', 'b', 'c', 'd'].map((id) => ({ id })), (id) => topics[id]);

  it('files each item once, under its strongest topic', () => {
    expect(groups.map((g) => [g.topic, g.items.map((i) => i.id)])).toEqual([
      ['ai', ['a', 'b']],
      ['sourdough', ['c']],
      ['Other', ['d']],
    ]);
  });
});

describe('extractJsonArray', () => {
  it('finds the array inside prose and fences', () => {
    expect(extractJsonArray('Here you go:\n```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
  });

  it('returns [] for junk', () => {
    expect(extractJsonArray('no json here')).toEqual([]);
    expect(extractJsonArray('[broken')).toEqual([]);
  });
});

const digest: DigestContent = {
  from: '26 Oct',
  to: '2 Nov',
  groups: [{ topic: 'ai', items: [{ id: 'i1', title: 'RAG <explained>', line: 'Search, then answer.' }] }],
  finds: [{ topic: 'ai', items: [{ title: 'A "great" read', url: 'https://example.com/a', why: 'Goes deeper.' }] }],
  lesson: { itemId: 'i2', itemTitle: 'Vector DBs', lessonId: 'l1' },
  stats: { saved: 1, played: 0 },
};

describe('renderDigestEmail', () => {
  const link = (to: string) => `https://heytoolie.com/d/x?to=${encodeURIComponent(to)}`;
  const email = renderDigestEmail(digest, link);

  it('validates against the content schema', () => {
    expect(digestContent.safeParse(digest).success).toBe(true);
  });

  it('builds a specific subject', () => {
    expect(email.subject).toBe('Your week: 1 save, 1 new find');
  });

  it('escapes model and user text', () => {
    expect(email.html).toContain('RAG &lt;explained&gt;');
    expect(email.html).toContain('A &quot;great&quot; read');
    expect(email.html).not.toContain('<explained>');
  });

  it('routes every link through the tracker', () => {
    const hrefs = [...email.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    for (const h of hrefs) expect(h.startsWith('https://heytoolie.com/d/x?to=')).toBe(true);
  });
});
describe('renderDigestEmail with a what-if', () => {
  const link = (to: string) => `https://heytoolie.com/d/x?to=${encodeURIComponent(to)}`;
  const withWhatIf: DigestContent = {
    ...digest,
    lesson: null,
    whatif: { itemId: 'i3', itemTitle: 'Solid-state <batteries>', scenario: 'What if they are in most new cars by 2030?' },
  };

  it('offers the what-if instead of a lesson, escaped and tracked', () => {
    const email = renderDigestEmail(withWhatIf, link);
    expect(digestContent.safeParse(withWhatIf).success).toBe(true);
    expect(email.html).toContain('What if they are in most new cars by 2030?');
    expect(email.html).toContain('Solid-state &lt;batteries&gt;');
    expect(email.html).toContain(encodeURIComponent('/items/i3?whatif=1'));
    expect(email.html).not.toContain('2-minute lesson');
    expect(email.text).toContain('WHAT IF: What if they are in most new cars by 2030?');
  });

  it('still reads digests saved before what-ifs existed', () => {
    expect(digestContent.safeParse(digest).success).toBe(true);
  });
});
