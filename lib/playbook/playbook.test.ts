import { describe, expect, it } from 'vitest';
import { extraction, MAX_LENSES, runDraft, type Framework, type FrameworkDraft, type RunDraft } from './schema';
import { areaCounts, cleanFrameworks, cleanIdea, filterFrameworks, finishRun, frameworkText, nameKey, pickList, pickedIndexes, runBrief } from './shape';

const draft = (over: Partial<FrameworkDraft> = {}): FrameworkDraft => ({
  name: 'Jobs to be done',
  kind: 'framework',
  from: 'Clayton Christensen',
  gist: 'People hire a product to get a job done in their life.',
  parts: [
    { label: 'The job', detail: 'What progress the person is trying to make' },
    { label: 'The hire', detail: 'What they use for it today' },
  ],
  use_when: 'Working out what a product is really competing with.',
  watch_out: null,
  example: 'Milkshakes bought for a long commute.',
  questions: ['What job is the customer hiring this for?', 'What do they fire to hire it?'],
  areas: ['product', 'strategy'],
  ...over,
});

const kept = (id: string, over: Partial<FrameworkDraft> = {}): Framework => ({ ...draft(over), id, createdAt: '2026-11-16T00:00:00Z', sources: [] });

describe('nameKey', () => {
  it('treats spellings of one framework as the same', () => {
    const key = nameKey('Jobs to be done');
    expect(nameKey('The Jobs-to-be-Done Framework (JTBD)')).toBe(key);
    expect(nameKey('  jobs to be DONE ')).toBe(key);
  });

  it('keeps different frameworks apart', () => {
    expect(nameKey('5 whys')).not.toBe(nameKey('5 forces'));
    expect(nameKey('The')).toBe('the');
    expect(nameKey('Framework')).toBe('framework');
  });

  it('is empty for a name with no letters or digits', () => {
    expect(nameKey('—')).toBe('');
  });
});

describe('cleanFrameworks', () => {
  it('drops a repeat of the same framework and tidies areas', () => {
    const out = cleanFrameworks([draft({ areas: [' Product', 'product', 'Strategy'] }), draft({ name: 'The Jobs-to-be-done framework' }), draft({ name: '5 whys' })]);
    expect(out.map((f) => f.name)).toEqual(['Jobs to be done', '5 whys']);
    expect(out[0].areas).toEqual(['product', 'strategy']);
  });

  it('turns blank optional fields into null', () => {
    expect(cleanFrameworks([draft({ from: '  ', example: '' })])[0]).toMatchObject({ from: null, example: null });
  });
});

describe('schemas', () => {
  it('accepts a save with nothing reusable', () => {
    expect(extraction.parse({ frameworks: [] }).frameworks).toEqual([]);
  });

  it('accepts a principle with no parts', () => {
    expect(extraction.safeParse({ frameworks: [draft({ kind: 'principle', parts: [] })] }).success).toBe(true);
  });

  it('rejects a framework with fewer than two questions', () => {
    expect(extraction.safeParse({ frameworks: [draft({ questions: ['Only one?'] })] }).success).toBe(false);
  });
});

describe('cleanIdea', () => {
  it('needs enough to work with', () => {
    expect(cleanIdea('an app')).toBeNull();
    expect(cleanIdea('  A subscription   box for home bakers ')).toBe('A subscription box for home bakers');
  });

  it('keeps paragraphs but not runs of blank lines', () => {
    expect(cleanIdea('First part of the idea.\n\n\n\nSecond part.')).toBe('First part of the idea.\n\nSecond part.');
  });
});

describe('picking', () => {
  it('numbers the list from 1', () => {
    expect(pickList([kept('a'), kept('b', { name: '5 whys' })]).split('\n')[1]).toMatch(/^2\. 5 whys: /);
  });

  it('keeps only real, unique picks, at most the limit', () => {
    expect(pickedIndexes([2, 2, 9, 0, 1], 3)).toEqual([1, 0]);
    expect(pickedIndexes([1, 2, 3, 4, 5], 5)).toHaveLength(MAX_LENSES);
    expect(pickedIndexes([], 5)).toEqual([]);
  });
});

describe('frameworkText', () => {
  it('writes the framework out with its number, parts and questions', () => {
    const text = frameworkText(draft(), 2);
    expect(text).toContain('[2] Jobs to be done (Clayton Christensen)');
    expect(text).toContain('1. The job: What progress');
    expect(text).toContain('- What do they fire to hire it?');
    expect(text).not.toContain('Watch out');
  });
});

describe('finishRun', () => {
  const lens = (framework: number): RunDraft['lenses'][number] => ({
    framework,
    why: 'It shows what you compete with.',
    points: [
      { label: 'The job', finding: 'A reliable weekend bake.' },
      { label: 'The hire', finding: 'Supermarket kits today.' },
    ],
    insight: 'You compete with kits, not other boxes.',
    unknowns: [],
  });
  const run = (lenses: RunDraft['lenses']): RunDraft =>
    runDraft.parse({ title: 'Baking box', lenses, bottom_line: 'Worth a small test.', next_steps: ['Ask five bakers.', 'Price a kit.'] });
  const offered = [kept('id-a'), kept('id-b', { name: '5 whys' })];

  it('swaps each number for the real framework', () => {
    const out = finishRun(run([lens(2), lens(1)]), offered);
    expect(out?.lenses.map((l) => [l.frameworkId, l.name])).toEqual([
      ['id-b', '5 whys'],
      ['id-a', 'Jobs to be done'],
    ]);
    expect(out?.lenses[0]).not.toHaveProperty('framework');
  });

  it('drops a lens for a framework that was not offered or was already used', () => {
    expect(finishRun(run([lens(1), lens(1), lens(7)]), offered)?.lenses).toHaveLength(1);
  });

  it('is null when no lens used an offered framework', () => {
    expect(finishRun(run([lens(0), lens(3)]), offered)).toBeNull();
  });
});

describe('the Playbook page', () => {
  const list = [kept('a'), kept('b', { name: '5 whys', gist: 'Ask why until you reach the cause.', areas: ['problem solving'], from: null, parts: [] })];

  it('counts areas, most used first', () => {
    expect(areaCounts([...list, kept('c', { areas: ['strategy'] })])[0]).toEqual({ area: 'strategy', count: 2 });
  });

  it('searches every word across name, gist, use, areas, author and parts', () => {
    expect(filterFrameworks(list, { search: 'christensen job' }).map((f) => f.id)).toEqual(['a']);
    expect(filterFrameworks(list, { search: 'WHY cause' }).map((f) => f.id)).toEqual(['b']);
    expect(filterFrameworks(list, { search: 'pricing' })).toEqual([]);
  });

  it('filters by area, with or without a search', () => {
    expect(filterFrameworks(list, { area: 'problem solving' }).map((f) => f.id)).toEqual(['b']);
    expect(filterFrameworks(list, { area: 'product', search: 'why' })).toEqual([]);
    expect(filterFrameworks(list, {})).toHaveLength(2);
  });
});

describe('runBrief', () => {
  it('gives the Council the idea, what each framework showed and what to test', () => {
    const brief = runBrief({
      idea: 'A subscription box for home bakers.',
      bottom_line: 'Worth a small test.',
      lenses: [{ frameworkId: 'a', name: 'Jobs to be done', why: '', points: [], insight: 'You compete with kits.', unknowns: [] }],
    });
    expect(brief.startsWith('A subscription box for home bakers.')).toBe(true);
    expect(brief).toContain('- Jobs to be done: You compete with kits.');
    expect(brief).toContain('Worth a small test.');
    expect(brief).toContain('Stress-test it');
  });
});
