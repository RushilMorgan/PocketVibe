import { describe, expect, it } from 'vitest';
import { parseOgImage, tiktokOembedUrl, youtubeThumbnail } from './thumbnail';

describe('youtubeThumbnail', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30',
  ])('builds the hqdefault image for %s', (url) => {
    expect(youtubeThumbnail(url)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('uses the portrait frame for Shorts', () => {
    expect(youtubeThumbnail('https://youtube.com/shorts/_YqYj9NKlrA')).toBe('https://i.ytimg.com/vi_webp/_YqYj9NKlrA/oar2.webp');
  });

  it('returns null for a channel link', () => {
    expect(youtubeThumbnail('https://www.youtube.com/@somechannel')).toBeNull();
  });
});

describe('tiktokOembedUrl', () => {
  it('encodes the video link', () => {
    expect(tiktokOembedUrl('https://www.tiktok.com/@a/video/123?x=1')).toBe(
      'https://www.tiktok.com/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40a%2Fvideo%2F123%3Fx%3D1',
    );
  });
});

describe('parseOgImage', () => {
  const page = 'https://example.com/blog/post';

  it('reads og:image', () => {
    expect(parseOgImage('<meta property="og:image" content="https://cdn.example.com/a.jpg">', page)).toBe(
      'https://cdn.example.com/a.jpg',
    );
  });

  it('handles content before property, single quotes and self-closing tags', () => {
    expect(parseOgImage(`<meta content='https://cdn.example.com/b.png' property='og:image' />`, page)).toBe(
      'https://cdn.example.com/b.png',
    );
  });

  it('prefers secure_url over og:image over twitter:image', () => {
    const html = `
      <meta name="twitter:image" content="https://t.example.com/t.jpg">
      <meta property="og:image" content="http://example.com/plain.jpg">
      <meta property="og:image:secure_url" content="https://example.com/secure.jpg">`;
    expect(parseOgImage(html, page)).toBe('https://example.com/secure.jpg');
  });

  it('falls back to twitter:image', () => {
    expect(parseOgImage('<meta name="twitter:image" content="https://t.example.com/t.jpg">', page)).toBe(
      'https://t.example.com/t.jpg',
    );
  });

  it('resolves relative paths and decodes entities', () => {
    expect(parseOgImage('<meta property="og:image" content="/img/cover.jpg?w=1200&amp;h=630">', page)).toBe(
      'https://example.com/img/cover.jpg?w=1200&h=630',
    );
  });

  it('keeps the first of repeated tags', () => {
    const html = '<meta property="og:image" content="https://a.com/1.jpg"><meta property="og:image" content="https://a.com/2.jpg">';
    expect(parseOgImage(html, page)).toBe('https://a.com/1.jpg');
  });

  it('ignores non-http schemes and pages with no image', () => {
    expect(parseOgImage('<meta property="og:image" content="data:image/png;base64,AAA">', page)).toBeNull();
    expect(parseOgImage('<meta name="description" content="hello">', page)).toBeNull();
  });
});
