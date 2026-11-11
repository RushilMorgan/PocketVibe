import { describe, expect, it } from 'vitest';
import { assignThemes, displayTopic, kindMix, themesHash, topicTrend } from './topic-view';

const NOW = new Date('2026-11-11T12:00:00Z');

describe('topicTrend', () => {
  it('marks topics first seen this week as new', () => {
    expect(topicTrend({ createdAt: '2026-11-08T10:00:00Z', lastSeenAt: '2026-11-08T10:00:00Z' }, NOW)).toBe('new');
  });
  it('marks topics with nothing new in two weeks as fading', () => {
    expect(topicTrend({ createdAt: '2026-10-01T10:00:00Z', lastSeenAt: '2026-10-25T10:00:00Z' }, NOW)).toBe('fading');
  });
  it('leaves active older topics alone', () => {
    expect(topicTrend({ createdAt: '2026-10-01T10:00:00Z', lastSeenAt: '2026-11-05T10:00:00Z' }, NOW)).toBeNull();
  });
});

describe('themesHash', () => {
  it('ignores order but changes on rename', () => {
    const a = [
      { id: '1', name: 'ai' },
      { id: '2', name: 'food' },
    ];
    expect(themesHash(a)).toBe(themesHash([...a].reverse()));
    expect(themesHash(a)).not.toBe(themesHash([{ id: '1', name: 'ml' }, a[1]]));
  });
});

describe('assignThemes', () => {
  const topics = [
    { id: 'a', name: 'artificial intelligence' },
    { id: 'b', name: 'chatgpt' },
    { id: 'c', name: 'high protein' },
    { id: 'd', name: 'geology' },
  ];

  it('maps names to ids, case-insensitively', () => {
    expect(
      assignThemes(topics, [
        { name: 'AI & tools', emoji: '🤖', topics: ['Artificial Intelligence', 'chatgpt'] },
        { name: 'Cooking', emoji: '🍳', topics: ['high protein'] },
        { name: 'Science', emoji: '🔬', topics: ['geology'] },
      ]),
    ).toEqual([
      { name: 'AI & tools', emoji: '🤖', topicIds: ['a', 'b'] },
      { name: 'Cooking', emoji: '🍳', topicIds: ['c'] },
      { name: 'Science', emoji: '🔬', topicIds: ['d'] },
    ]);
  });

  it('keeps each topic once, drops invented ones and empty themes, and catches leftovers', () => {
    expect(
      assignThemes(topics, [
        { name: 'AI', emoji: '🤖', topics: ['chatgpt', 'chatgpt', 'robots'] },
        { name: 'Again', emoji: '🔁', topics: ['chatgpt'] },
      ]),
    ).toEqual([
      { name: 'AI', emoji: '🤖', topicIds: ['b'] },
      { name: 'Everything else', emoji: '🧩', topicIds: ['a', 'c', 'd'] },
    ]);
  });
});

describe('kindMix', () => {
  it('counts saves by kind, biggest first, with percentages', () => {
    expect(kindMix(['tech', 'recipe', 'tech', null, 'other'])).toEqual([
      { kind: 'tech', count: 2, percent: 50 },
      { kind: 'recipe', count: 1, percent: 25 },
      { kind: 'other', count: 1, percent: 25 },
    ]);
    expect(kindMix([])).toEqual([]);
  });
});

describe('displayTopic', () => {
  it('title-cases but keeps acronyms and brand spellings', () => {
    expect(displayTopic('local ai')).toBe('Local AI');
    expect(displayTopic('chatgpt')).toBe('ChatGPT');
    expect(displayTopic('saas')).toBe('SaaS');
    expect(displayTopic('amazon kdp')).toBe('Amazon KDP');
    expect(displayTopic('devops security')).toBe('DevOps Security');
    expect(displayTopic('the fourth turning')).toBe('The Fourth Turning');
    expect(displayTopic('sociology of the internet')).toBe('Sociology of the Internet');
  });
});
