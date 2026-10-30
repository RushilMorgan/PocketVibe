/**
 * Pure checks on model-written Mermaid, before the real parser runs. These
 * catch the things mermaid.parse() accepts but we don't want: styling,
 * click handlers, our own init block being overridden, unsupported types.
 */

export const DIAGRAM_TYPES = ['flowchart', 'sequenceDiagram', 'mindmap'] as const;
export type DiagramType = (typeof DIAGRAM_TYPES)[number];

const FORBIDDEN = /^\s*(style|classDef|class|click|linkStyle|%%\{)/m;

/** Strips code fences and stray whitespace the model sometimes adds. */
export function cleanMermaid(raw: string): string {
  return raw
    .replace(/^\s*```(?:mermaid)?\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim();
}

/** The diagram type, or null if it isn't one we render. `graph` is old syntax for flowchart. */
export function diagramType(code: string): DiagramType | null {
  const first = code.split('\n').find((l) => l.trim() && !l.trim().startsWith('%%'))?.trim() ?? '';
  if (/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)\b/.test(first)) return 'flowchart';
  if (first === 'sequenceDiagram') return 'sequenceDiagram';
  if (first === 'mindmap') return 'mindmap';
  return null;
}

/** Problems to send back to the model on the retry, or [] if it looks fine. */
export function lintMermaid(code: string): string[] {
  const problems: string[] = [];
  if (!diagramType(code)) problems.push('Start with "flowchart TD", "flowchart LR", "sequenceDiagram" or "mindmap".');
  if (FORBIDDEN.test(code)) problems.push('Remove all styling, classes, click handlers and %%{init}%% blocks.');
  if (code.length > 2000) problems.push('Too long: keep it to at most 8 nodes.');
  return problems;
}
