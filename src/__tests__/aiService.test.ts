/**
 * Unit tests for aiService.ts — all execution paths are covered:
 *   - missing API key → GeminiConfigError
 *   - clean JSON array → parsed blocks returned
 *   - markdown-fenced JSON → fences stripped before parse
 *   - non-array JSON → Error thrown
 *   - non-JSON text → Error thrown
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateBlocks, GeminiConfigError } from '../services/aiService';

// ── Hoist mock refs so they're available inside vi.mock factory ───────────────
const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockGetGenerativeModel = vi.hoisted(() =>
  vi.fn().mockReturnValue({ generateContent: mockGenerateContent }),
);

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function (this: any) {
    this.getGenerativeModel = mockGetGenerativeModel;
  }),
}));

// ── Helper ────────────────────────────────────────────────────────────────────

function setResponse(text: string) {
  mockGenerateContent.mockResolvedValue({ response: { text: () => text } });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('generateBlocks', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('throws GeminiConfigError when API key is absent', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    await expect(generateBlocks('anything')).rejects.toBeInstanceOf(GeminiConfigError);
  });

  it('returns parsed blocks from a clean JSON array response', async () => {
    const blocks = [
      { type: 'action_button', id: 'b1', label: 'Go', icon: '🚀' },
    ];
    setResponse(JSON.stringify(blocks));

    const result = await generateBlocks('build a button');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('action_button');
  });

  it('strips markdown fences before parsing', async () => {
    const blocks = [{ type: 'hero_banner', id: 'b1', title: 'Hi', subtitle: 'Sub', ctaLabel: 'Go' }];
    setResponse(`\`\`\`json\n${JSON.stringify(blocks)}\n\`\`\``);

    const result = await generateBlocks('hero block');
    expect(result[0].type).toBe('hero_banner');
  });

  it('strips plain ``` fences without language tag', async () => {
    const blocks = [{ type: 'metrics_row', id: 'b1', metrics: [{ label: 'A', value: '1' }] }];
    setResponse(`\`\`\`\n${JSON.stringify(blocks)}\n\`\`\``);

    const result = await generateBlocks('metrics');
    expect(result[0].type).toBe('metrics_row');
  });

  it('throws when Gemini returns a JSON object (not array)', async () => {
    setResponse('{"type":"hero_banner"}');
    await expect(generateBlocks('test')).rejects.toThrow(/not a JSON array/i);
  });

  it('throws when Gemini returns non-JSON text', async () => {
    setResponse('Sorry, I cannot help with that.');
    await expect(generateBlocks('test')).rejects.toThrow(/non-JSON/i);
  });

  it('returns multiple blocks when Gemini sends an array of 3', async () => {
    const blocks = [
      { type: 'hero_banner',      id: 'b1', title: 'T', subtitle: 'S', ctaLabel: 'Go' },
      { type: 'interactive_list', id: 'b2', items: [{ id: 'i1', label: 'X', icon: '📌', state: 'Pending' }] },
      { type: 'action_button',    id: 'b3', label: 'Act' },
    ];
    setResponse(JSON.stringify(blocks));

    const result = await generateBlocks('full layout');
    expect(result).toHaveLength(3);
  });
});
