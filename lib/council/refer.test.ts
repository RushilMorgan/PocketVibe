import { describe, expect, it } from 'vitest';
import { frameText } from './format';
import { cleanQuestion, DEFAULT_QUESTION, saveBrief } from './refer';
import { frameSchema, newSessionRequest, verdictLabel, VERDICTS, VERDICT_LABELS, type Frame } from './schemas';

const save = {
  title: 'Solid-state batteries are leaving the lab',
  url: 'https://example.com/batteries',
  kind: 'tech',
  gist: ['They swap the liquid in a battery for a solid.', 'Cost is the hard part.'],
  whyItMatters: 'Range and charging are why people avoid electric cars.',
  text: 'Toyota says 2027.   \nOthers are less sure.',
};

describe('saveBrief', () => {
  it('leads with the question, then what the save says and an excerpt', () => {
    expect(saveBrief(' Is  2027 realistic? ', save)).toBe(
      [
        'Is 2027 realistic?',
        'This is about something I saved (tech): “Solid-state batteries are leaving the lab”\nhttps://example.com/batteries',
        'What it says, in short:\n- They swap the liquid in a battery for a solid.\n- Cost is the hard part.',
        "Why it's said to matter: Range and charging are why people avoid electric cars.",
        'From the source itself:\nToyota says 2027.\nOthers are less sure.',
      ].join('\n\n'),
    );
  });

  it('asks a default question when none is typed, and skips empty parts', () => {
    const brief = saveBrief('', { title: null, url: 'https://x.test/a', kind: null, gist: [], text: null });
    expect(brief).toBe(`${DEFAULT_QUESTION}\n\nThis is about something I saved: untitled\nhttps://x.test/a`);
  });

  it('cuts a long source down to an excerpt', () => {
    const brief = saveBrief('Thoughts?', { ...save, text: 'word '.repeat(2000) });
    expect(brief.length).toBeLessThan(4200);
    expect(brief.endsWith('…')).toBe(true);
  });

  it('limits the question to one line of 600 characters', () => {
    expect(cleanQuestion('a\nb')).toBe('a b');
    expect(cleanQuestion('x'.repeat(900))).toHaveLength(600);
    expect(cleanQuestion(undefined)).toBe(DEFAULT_QUESTION);
  });
});

describe('modes', () => {
  it('words the same verdict scale for decisions, claims and questions', () => {
    expect(verdictLabel('go', 'decision')).toBe('Go');
    expect(verdictLabel('go', 'claim')).toBe('Holds up');
    expect(verdictLabel('drop', 'claim')).toBe("Doesn't hold up");
    expect(verdictLabel('park', 'question')).toBe('It depends');
    for (const labels of Object.values(VERDICT_LABELS)) expect(Object.keys(labels).sort()).toEqual([...VERDICTS].sort());
  });

  it('treats reports from before modes as ideas', () => {
    expect(verdictLabel('refine')).toBe('Refine first');
    expect(verdictLabel('refine', null)).toBe('Refine first');
  });

  it('tells members the mode in the frame, defaulting old frames to decision', () => {
    const frame: Frame = {
      mode: 'claim',
      title: 'Seed oils',
      kind: 'Health claim',
      restated: 'Whether seed oils cause inflammation.',
      assumptions: ['a', 'b'],
      sections: [
        { key: 'evidence', heading: 'Evidence', focus: 'What trials show' },
        { key: 'source', heading: 'Source', focus: 'Who says it' },
      ],
      questions: ['q1', 'q2'],
    };
    expect(frameSchema.safeParse(frame).success).toBe(true);
    expect(frameText(frame).startsWith('Mode: claim\n\nWhat was brought (Health claim): Whether seed oils')).toBe(true);
    const { mode: _mode, ...old } = frame;
    expect(frameText(old as Frame).startsWith('Mode: decision')).toBe(true);
    expect(frameSchema.safeParse(old).success).toBe(false); // new replies must say
  });
});

describe('newSessionRequest', () => {
  it('takes anything typed, or a save with an optional question', () => {
    expect(newSessionRequest.safeParse({ idea: 'Is creatine worth taking?' }).success).toBe(true);
    expect(newSessionRequest.safeParse({ itemId: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
    expect(newSessionRequest.safeParse({ itemId: '11111111-1111-4111-8111-111111111111', question: 'Is this true?' }).success).toBe(true);
    expect(newSessionRequest.safeParse({ idea: 'short' }).success).toBe(false);
    expect(newSessionRequest.safeParse({ itemId: 'nope' }).success).toBe(false);
  });
});
