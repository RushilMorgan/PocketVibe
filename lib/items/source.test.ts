import { describe, expect, it } from 'vitest';
import { detectSource, extractUrl, normalizeUrl, parseLengthSeconds, youtubeWatchUrl } from './source';

describe('extractUrl', () => {
  it('prefers the url field', () => {
    expect(extractUrl({ url: 'https://example.com/a', text: 'https://other.com' })).toBe('https://example.com/a');
  });

  it('finds a link buried in shared text (YouTube app style)', () => {
    expect(extractUrl({ text: 'Check this out https://youtube.com/shorts/abc123?si=xyz' })).toBe(
      'https://youtube.com/shorts/abc123',
    );
  });

  it('returns null when there is no link', () => {
    expect(extractUrl({ text: 'just words', title: null })).toBeNull();
  });
});

describe('normalizeUrl', () => {
  it('strips tracking params, hash and trailing punctuation', () => {
    expect(normalizeUrl('https://news.site/story?id=4&utm_source=x&fbclid=y#top).')).toBe('https://news.site/story?id=4');
  });

  it('rejects non-http schemes', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('youtubeWatchUrl', () => {
  it.each([
    ['https://youtube.com/shorts/abc123XYZ', 'https://www.youtube.com/watch?v=abc123XYZ'],
    ['https://youtu.be/abc123XYZ', 'https://www.youtube.com/watch?v=abc123XYZ'],
    ['https://m.youtube.com/watch?v=abc123XYZ&t=4', 'https://www.youtube.com/watch?v=abc123XYZ'],
    ['https://www.youtube.com/live/abc123XYZ', 'https://www.youtube.com/watch?v=abc123XYZ'],
  ])('%s', (url, expected) => {
    expect(youtubeWatchUrl(url)).toBe(expected);
  });

  it('returns null for a channel page', () => {
    expect(youtubeWatchUrl('https://www.youtube.com/@somechannel')).toBeNull();
  });
});

describe('parseLengthSeconds', () => {
  it('reads the player length', () => {
    expect(parseLengthSeconds('..."videoId":"x","lengthSeconds":"1385","keywords"...')).toBe(1385);
  });

  it('returns null when absent', () => {
    expect(parseLengthSeconds('<html></html>')).toBeNull();
  });
});

describe('detectSource', () => {
  it.each([
    ['https://www.youtube.com/watch?v=1', 'youtube'],
    ['https://youtu.be/1', 'youtube'],
    ['https://m.youtube.com/shorts/1', 'youtube'],
    ['https://www.tiktok.com/@a/video/1', 'tiktok'],
    ['https://www.instagram.com/reel/1', 'other'],
    ['https://www.bbc.com/news/1', 'article'],
  ])('%s → %s', (url, source) => {
    expect(detectSource(url)).toBe(source);
  });
});
