import { describe, expect, it } from 'vitest';
import { isContentUrl, limitPerHost, parsePageMeta, titleFromSlug } from './pages';

describe('parsePageMeta', () => {
  it('prefers Open Graph tags, in either attribute order', () => {
    const html = `<head><title>Site | Fallback</title>
      <meta content="How vector search works" property="og:title">
      <meta property="og:description" content="A clear walk-through &amp; demo.">
      </head>`;
    expect(parsePageMeta(html)).toEqual({ title: 'How vector search works', description: 'A clear walk-through & demo.' });
  });

  it('falls back to <title> and meta description', () => {
    const html = '<title>\n  RAG, explained  </title><meta name="description" content="Short &#39;intro&#39;">';
    expect(parsePageMeta(html)).toEqual({ title: 'RAG, explained', description: "Short 'intro'" });
  });

  it('decodes hex and decimal entities', () => {
    expect(parsePageMeta('<title>What&#x27;s new &#8212; AI</title>').title).toBe('What\'s new — AI');
  });

  it('returns empty strings when there is nothing', () => {
    expect(parsePageMeta('<html></html>')).toEqual({ title: '', description: '' });
  });
});

describe('isContentUrl', () => {
  it.each([
    ['https://example.com/blog/how-rag-works', true],
    ['https://www.youtube.com/watch?v=abc123', true],
    ['https://arxiv.org/abs/2312.10997', true],
    ['https://example.com/', false],
    ['https://example.com', false],
    ['https://example.com/tag/ai', false],
    ['https://example.com/search?q=rag', false],
    ['https://www.youtube.com/@fireship', false],
    ['https://www.youtube.com/results?search_query=rag', false],
    ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', false],
    ['not a url', false],
  ])('%s → %s', (url, expected) => {
    expect(isContentUrl(url)).toBe(expected);
  });
});

describe('titleFromSlug', () => {
  it('drops Medium-style hashes and capitalises', () => {
    expect(
      titleFromSlug('https://pub.towardsai.net/part-1-retrieval-augmented-generation-rag-from-first-principles-1508c7378dd9'),
    ).toBe('Part 1 retrieval augmented generation rag from first principles');
  });

  it('drops numeric ids and file extensions', () => {
    expect(titleFromSlug('https://example.com/news/123456-vector-search-gets-faster.html')).toBe('Vector search gets faster');
  });

  it('returns empty for slugs too short to mean anything', () => {
    expect(titleFromSlug('https://example.com/p/abc')).toBe('');
  });
});

describe('limitPerHost', () => {
  it('keeps at most n pages per site, ignoring www.', () => {
    const pages = ['https://a.com/1', 'https://www.a.com/2', 'https://a.com/3', 'https://b.com/1'].map((url) => ({ url }));
    expect(limitPerHost(pages, 2).map((p) => p.url)).toEqual(['https://a.com/1', 'https://www.a.com/2', 'https://b.com/1']);
  });
});
