import 'server-only';

type Mermaid = typeof import('mermaid').default;
let loaded: Promise<Mermaid> | undefined;

/**
 * mermaid.parse() needs a DOM (it sanitises labels with DOMPurify), so give it
 * a jsdom window once per server instance before importing it.
 */
function mermaid(): Promise<Mermaid> {
  loaded ??= (async () => {
    const { JSDOM } = await import('jsdom');
    const { window } = new JSDOM('');
    const g = globalThis as unknown as { window?: unknown; document?: unknown };
    g.window ??= window;
    g.document ??= window.document;
    return (await import('mermaid')).default;
  })();
  return loaded;
}

/** The real Mermaid parser. Returns the parse error message, or null if valid. */
export async function parseError(code: string): Promise<string | null> {
  try {
    await (await mermaid()).parse(code);
    return null;
  } catch (err) {
    return String((err as Error)?.message ?? err).replace(/\s+/g, ' ').slice(0, 500);
  }
}
