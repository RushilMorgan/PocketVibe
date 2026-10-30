import { describe, expect, it } from 'vitest';
import { cleanMermaid, diagramType, lintMermaid } from './clean';

describe('cleanMermaid', () => {
  it('strips code fences', () => {
    expect(cleanMermaid('```mermaid\nflowchart TD\n  A --> B\n```')).toBe('flowchart TD\n  A --> B');
  });

  it('leaves clean code alone', () => {
    expect(cleanMermaid('mindmap\n  root((x))')).toBe('mindmap\n  root((x))');
  });
});

describe('diagramType', () => {
  it.each([
    ['flowchart LR\n A --> B', 'flowchart'],
    ['graph TD\n A --> B', 'flowchart'],
    ['sequenceDiagram\n A->>B: hi', 'sequenceDiagram'],
    ['mindmap\n  root((x))', 'mindmap'],
    ['pie\n "a": 1', null],
    ['classDiagram\n A <|-- B', null],
  ])('%s', (code, type) => {
    expect(diagramType(code)).toBe(type);
  });
});

describe('lintMermaid', () => {
  it('passes a plain flowchart', () => {
    expect(lintMermaid('flowchart TD\n  A[Ask] --> B[Answer]')).toEqual([]);
  });

  it('rejects styling and init overrides', () => {
    expect(lintMermaid('flowchart TD\n  A --> B\n  style A fill:#f00')).toHaveLength(1);
    expect(lintMermaid('%%{init: {"theme":"dark"}}%%\nflowchart TD\n  A --> B')).toHaveLength(1);
  });

  it('rejects unsupported diagram types', () => {
    expect(lintMermaid('pie\n "a": 1')[0]).toMatch(/Start with/);
  });
});
