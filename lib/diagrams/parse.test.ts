import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { parseError } = await import('./parse');

describe('parseError (real mermaid.parse under jsdom)', () => {
  it.each([
    'flowchart TD\n  A[Ask] --> B[Answer]',
    'sequenceDiagram\n  App->>API: Request\n  API-->>App: Reply',
    'mindmap\n  root((RAG))\n    Retrieve\n    Generate',
  ])('accepts %s', async (code) => {
    expect(await parseError(code)).toBeNull();
  });

  it('returns the parser message for broken code', async () => {
    expect(await parseError('flowchart TD\n  A[x] --> B{y')).toMatch(/Parse error/);
  });
}, 30_000);
