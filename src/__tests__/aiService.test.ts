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

// ── Edge function error handling ─────────────────────────────────────────────

import { AIGenerationError } from '../services/aiService';
import { validateGenerateResponse } from '../lib/validator';
import { containsHtmlLikeText } from '../lib/htmlGuard';
import { normalizeGenerateResponse } from '../lib/normalizeResponse';

describe('generateViaEdgeFunction error handling', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('throws a friendly error (not raw HTML) when Supabase returns an HTML 500 error page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: (_: string) => 'text/html; charset=utf-8' },
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue('<html><head></head><body>Internal Server Error</body></html>'),
    }));
    const err = await generateCreation({ userRequest: 'budget', mode: 'new' }).catch(e => e);
    expect(err).toBeInstanceOf(AIGenerationError);
    expect(containsHtmlLikeText(err.message)).toBe(false);
    expect(err.message).toMatch(/problem|try again/i);
  });

  it('shows a specific message for 404 (not deployed)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: (_: string) => 'text/html' },
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue('<html>Not Found</html>'),
    }));
    const err = await generateCreation({ userRequest: 'budget', mode: 'new' }).catch(e => e);
    expect(err).toBeInstanceOf(AIGenerationError);
    expect(err.message).toMatch(/not deployed/i);
    expect(containsHtmlLikeText(err.message)).toBe(false);
  });

  it('shows a specific message for 429 (rate limit)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (_: string) => 'application/json' },
      statusText: 'Too Many Requests',
      text: vi.fn().mockResolvedValue('{"error":"rate_limit"}'),
    }));
    const err = await generateCreation({ userRequest: 'budget', mode: 'new' }).catch(e => e);
    expect(err).toBeInstanceOf(AIGenerationError);
    expect(err.message).toMatch(/too many/i);
  });
});

// ── HTML guard ────────────────────────────────────────────────────────────────

describe('containsHtmlLikeText', () => {
  it('returns true for a full HTML page', () => {
    expect(containsHtmlLikeText('<html><head></head><body>Hello</body></html>')).toBe(true);
  });
  it('returns true for closing tags', () => {
    expect(containsHtmlLikeText('</div>')).toBe(true);
  });
  it('returns true for DOCTYPE', () => {
    expect(containsHtmlLikeText('<!DOCTYPE html>')).toBe(true);
  });
  it('returns false for plain text', () => {
    expect(containsHtmlLikeText('I made you a budget tracker!')).toBe(false);
  });
  it('returns false for non-strings', () => {
    expect(containsHtmlLikeText(42)).toBe(false);
    expect(containsHtmlLikeText(null)).toBe(false);
    expect(containsHtmlLikeText(undefined)).toBe(false);
  });
});

// ── normalizeGenerateResponse ─────────────────────────────────────────────────

const BASE_REQ = { userRequest: 'make a checklist', mode: 'new' as const };

describe('normalizeGenerateResponse', () => {
  it('returns the response unchanged when it is valid and clean', () => {
    const result = normalizeGenerateResponse(VALID_CHECKLIST_RESPONSE as any, BASE_REQ);
    expect(result).not.toBeNull();
    expect(result!.title).toBe(VALID_CHECKLIST_RESPONSE.title);
  });

  it('returns null for generative_html creationType', () => {
    const res = {
      title: 'My Website',
      creationType: 'generative_html',
      description: '',
      summary: 'Here is your website.',
      content: { type: 'generative_html', tailwindMarkup: '<div>Hello</div>' },
    };
    const result = normalizeGenerateResponse(res as any, BASE_REQ);
    expect(result).toBeNull();
  });

  it('returns null when content.type does not match creationType', () => {
    const res = {
      ...VALID_CHECKLIST_RESPONSE,
      creationType: 'habit_tracker', // mismatch
    };
    const result = normalizeGenerateResponse(res as any, BASE_REQ);
    expect(result).toBeNull();
  });

  it('replaces HTML in summary with safe fallback text', () => {
    const res = {
      ...VALID_CHECKLIST_RESPONSE,
      summary: '<html><body>Here is your checklist!</body></html>',
    };
    const result = normalizeGenerateResponse(res as any, BASE_REQ);
    expect(result).not.toBeNull();
    expect(containsHtmlLikeText(result!.summary)).toBe(false);
    expect(result!.summary).toBe('I made this for you. You can edit it below.');
  });

  it('replaces HTML in title with safe fallback', () => {
    const res = {
      ...VALID_CHECKLIST_RESPONSE,
      title: '<div class="title">My List</div>',
    };
    const result = normalizeGenerateResponse(res as any, BASE_REQ);
    expect(result).not.toBeNull();
    expect(containsHtmlLikeText(result!.title)).toBe(false);
  });
});

// ── Validator rejects generative_html ────────────────────────────────────────

describe('validator — generative_html rejection', () => {
  it('rejects generative_html as an unsupported creationType', () => {
    const res = {
      title: 'My Website',
      creationType: 'generative_html',
      description: '',
      summary: 'Here is your website.',
      content: { type: 'generative_html', tailwindMarkup: '<div>Hello</div>' },
    };
    const { valid, errors } = validateGenerateResponse(res);
    expect(valid).toBe(false);
    expect(errors.some(e => /unsupported/i.test(e))).toBe(true);
  });

  it('accepts budget_calculator as a valid creationType', () => {
    const res = {
      title: 'Monthly Budget',
      creationType: 'budget_calculator',
      description: 'Track income and expenses',
      summary: 'Here is your budget.',
      content: {
        type: 'budget_calculator',
        currency: 'R',
        income: [{ id: 'i1', label: 'Salary', amount: 20000 }],
        expenses: [{ id: 'e1', label: 'Rent', category: 'Housing', amount: 5000 }],
      },
    };
    const { valid } = validateGenerateResponse(res);
    expect(valid).toBe(true);
  });
});
