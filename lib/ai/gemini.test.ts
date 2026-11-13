import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const generateContent = vi.fn();
const generateContentStream = vi.fn();
const recordUsage = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({
  env: () => ({ GEMINI_API_KEY: 'k', GEMINI_MODEL_FAST: 'gemini-3.8-flash', GEMINI_MODEL_PRO: 'gemini-4-argon' }),
}));
vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>();
  return { ...actual, GoogleGenAI: class { models = { generateContent, generateContentStream } } };
});
vi.mock('./usage', () => ({ recordUsage, currentUsage: () => ({ userId: 'u1', itemId: 'i1' }) }));

const { generateGrounded, generateJson, streamText } = await import('./gemini');
const schema = z.object({ ok: z.boolean() });

beforeEach(() => {
  generateContent.mockReset().mockResolvedValue({ text: '{"ok":true}' });
  generateContentStream.mockReset();
  recordUsage.mockReset().mockResolvedValue(undefined);
});

const lastCall = () => generateContent.mock.calls.at(-1)![0] as { model: string; config: { thinkingConfig?: unknown } };

describe('generateJson model selection', () => {
  it('uses the tier default when no model is chosen', async () => {
    await generateJson(schema, [{ text: 'x' }], { feature: 'other', model: 'pro' });
    expect(lastCall().model).toBe('gemini-4-argon');
    expect(lastCall().config.thinkingConfig).toEqual({ thinkingLevel: 'MEDIUM' });
  });

  it("uses the user's chosen model over the tier default", async () => {
    await generateJson(schema, [{ text: 'x' }], { feature: 'other', model: 'pro', modelId: 'gemini-3.8-flash' });
    expect(lastCall().model).toBe('gemini-3.8-flash');
  });

  it('only sends a thinking level to models that support one', async () => {
    await generateJson(schema, [{ text: 'x' }], { feature: 'other', model: 'pro', modelId: 'gemini-3.1-pro-preview' });
    expect(lastCall().config.thinkingConfig).toBeUndefined();
    await generateJson(schema, [{ text: 'x' }], { feature: 'other', model: 'fast' });
    expect(lastCall().config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
  });
});

describe('usage logging', () => {
  it('logs tokens, thinking, cached and search-result tokens against the feature', async () => {
    generateContent.mockResolvedValue({
      text: '{"ok":true}',
      usageMetadata: { promptTokenCount: 1000, toolUsePromptTokenCount: 200, cachedContentTokenCount: 300, candidatesTokenCount: 50, thoughtsTokenCount: 70 },
    });
    await generateJson(schema, [{ text: 'x' }], { feature: 'explainer', model: 'pro' });
    expect(recordUsage).toHaveBeenCalledWith(
      {
        feature: 'explainer',
        provider: 'gemini',
        model: 'gemini-4-argon',
        inputTokens: 1200,
        cachedTokens: 300,
        outputTokens: 50,
        thinkingTokens: 70,
        searchQueries: 0,
      },
      undefined,
    );
  });

  it('logs a reply that fails validation too (it was paid for)', async () => {
    generateContent.mockResolvedValue({ text: '{"ok":"no"}', usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });
    await expect(generateJson(schema, [{ text: 'x' }], { feature: 'lesson' })).rejects.toThrow('failed validation');
    expect(recordUsage).toHaveBeenCalledOnce();
  });

  it('counts the Google searches a grounded call ran', async () => {
    generateContent.mockResolvedValue({
      text: 'finds',
      candidates: [{ groundingMetadata: { webSearchQueries: ['a', 'b', 'c'], groundingChunks: [] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });
    await generateGrounded('find things', { feature: 'digest' });
    expect(recordUsage.mock.calls[0][0]).toMatchObject({ feature: 'digest', searchQueries: 3 });
  });

  it("logs a stream once, from its last chunk, against the caller's scope", async () => {
    generateContentStream.mockResolvedValue(
      (async function* () {
        yield { text: 'Hel', usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 1 } };
        yield { text: 'lo', usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 2, thoughtsTokenCount: 9 } };
      })(),
    );
    const out: string[] = [];
    for await (const chunk of streamText('sys', [{ role: 'user', text: 'hi' }], { feature: 'chat', model: 'pro' })) out.push(chunk);
    expect(out.join('')).toBe('Hello');
    expect(recordUsage).toHaveBeenCalledOnce();
    expect(recordUsage.mock.calls[0]).toEqual([
      expect.objectContaining({ feature: 'chat', inputTokens: 100, outputTokens: 2, thinkingTokens: 9 }),
      { userId: 'u1', itemId: 'i1' },
    ]);
  });
});
