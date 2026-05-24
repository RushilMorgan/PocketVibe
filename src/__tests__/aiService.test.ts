import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateCreation, generateOfflineFallback, GeminiConfigError, AIConfigError } from '../services/aiService';

// ── Hoist mock refs ────────────────────────────────────────────────────────────
const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockGetGenerativeModel = vi.hoisted(() =>
  vi.fn().mockReturnValue({ generateContent: mockGenerateContent }),
);

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function (this: any) {
    this.getGenerativeModel = mockGetGenerativeModel;
  }),
}));

function setResponse(text: string) {
  mockGenerateContent.mockResolvedValue({ response: { text: () => text } });
}

const VALID_CHECKLIST_RESPONSE = {
  title: 'My Checklist',
  creationType: 'checklist',
  description: 'A simple checklist',
  summary: 'Here is your checklist.',
  content: {
    type: 'checklist',
    sections: [{ id: 's1', title: 'Tasks', items: [{ id: 'i1', label: 'Task 1', checked: false }] }],
  },
};

describe('generateCreation', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-api-key');
    vi.stubEnv('VITE_SUPABASE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('throws AIConfigError when no API key or Supabase URL', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    await expect(generateCreation({ userRequest: 'anything', mode: 'new' })).rejects.toBeInstanceOf(AIConfigError);
  });

  it('GeminiConfigError is an alias for AIConfigError', () => {
    expect(GeminiConfigError).toBe(AIConfigError);
  });

  it('returns parsed GenerateResponse from valid JSON', async () => {
    setResponse(JSON.stringify(VALID_CHECKLIST_RESPONSE));
    const result = await generateCreation({ userRequest: 'make a checklist', mode: 'new' });
    expect(result.title).toBe('My Checklist');
    expect(result.creationType).toBe('checklist');
    expect(result.content.type).toBe('checklist');
  });

  it('strips markdown fences before parsing', async () => {
    setResponse('```json\n' + JSON.stringify(VALID_CHECKLIST_RESPONSE) + '\n```');
    const result = await generateCreation({ userRequest: 'checklist', mode: 'new' });
    expect(result.title).toBe('My Checklist');
  });

  it('calls onProgress with status messages', async () => {
    setResponse(JSON.stringify(VALID_CHECKLIST_RESPONSE));
    const progress: string[] = [];
    await generateCreation({ userRequest: 'checklist', mode: 'new' }, (s) => progress.push(s));
    expect(progress.length).toBeGreaterThan(0);
  });

  it('retries once when response fails validation', async () => {
    const invalid = { title: 123, creationType: 'checklist', description: '', summary: '', content: { type: 'checklist', sections: [] } };
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(invalid) } })
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(VALID_CHECKLIST_RESPONSE) } });
    const result = await generateCreation({ userRequest: 'checklist', mode: 'new' });
    expect(result.title).toBe('My Checklist');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});

describe('generateOfflineFallback', () => {
  it('returns a habit_tracker for habit-related requests', () => {
    const result = generateOfflineFallback('daily habit tracker');
    expect(result.creationType).toBe('habit_tracker');
    expect(result.content.type).toBe('habit_tracker');
  });

  it('returns a budget_calculator for money-related requests', () => {
    const result = generateOfflineFallback('monthly expenses and income');
    expect(result.creationType).toBe('budget_calculator');
  });

  it('returns a savings_tracker for savings-related requests', () => {
    const result = generateOfflineFallback('saving for a holiday');
    expect(result.creationType).toBe('savings_tracker');
  });

  it('defaults to checklist for unrecognized requests', () => {
    const result = generateOfflineFallback('something random');
    expect(result.creationType).toBe('checklist');
  });

  it('always returns a valid GenerateResponse shape', () => {
    const result = generateOfflineFallback('whatever');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('creationType');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveProperty('type');
  });
});
