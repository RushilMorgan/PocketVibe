import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const generateContent = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({
  env: () => ({ GEMINI_API_KEY: 'k', GEMINI_MODEL_FAST: 'gemini-3.8-flash', GEMINI_MODEL_PRO: 'gemini-4-argon' }),
}));
vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>();
  return { ...actual, GoogleGenAI: class { models = { generateContent } } };
});

const { generateJson } = await import('./gemini');
const schema = z.object({ ok: z.boolean() });

beforeEach(() => {
  generateContent.mockReset().mockResolvedValue({ text: '{"ok":true}' });
});

const lastCall = () => generateContent.mock.calls.at(-1)![0] as { model: string; config: { thinkingConfig?: unknown } };

describe('generateJson model selection', () => {
  it('uses the tier default when no model is chosen', async () => {
    await generateJson(schema, [{ text: 'x' }], { model: 'pro' });
    expect(lastCall().model).toBe('gemini-4-argon');
    expect(lastCall().config.thinkingConfig).toEqual({ thinkingLevel: 'MEDIUM' });
  });

  it("uses the user's chosen model over the tier default", async () => {
    await generateJson(schema, [{ text: 'x' }], { model: 'pro', modelId: 'gemini-3.8-flash' });
    expect(lastCall().model).toBe('gemini-3.8-flash');
  });

  it('only sends a thinking level to models that support one', async () => {
    await generateJson(schema, [{ text: 'x' }], { model: 'pro', modelId: 'gemini-3.1-pro-preview' });
    expect(lastCall().config.thinkingConfig).toBeUndefined();
    await generateJson(schema, [{ text: 'x' }], { model: 'fast' });
    expect(lastCall().config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
  });
});
