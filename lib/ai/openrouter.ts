import 'server-only';
import { z } from 'zod';
import { councilEnv, env } from '@/lib/env';

/**
 * Models from every vendor through one OpenAI-compatible gateway (OpenRouter
 * by default; OPENROUTER_BASE_URL can point at another). Used by the Council,
 * where the point is several *different* models — everything else stays on
 * the Gemini client.
 */

export type Effort = 'low' | 'medium' | 'high';

export interface OrOptions {
  model: string;
  system: string;
  user: string;
  /** Reasoning depth, normalised across vendors by the gateway. */
  effort?: Effort;
  /** Live web search; the pages it read come back as `citations`. */
  web?: boolean;
}

export interface Citation {
  url: string;
  title: string;
}

export interface OrResult<T> {
  data: T;
  /** USD for this call as billed by the gateway (0 if it didn't say). */
  cost: number;
  citations: Citation[];
}

const TIMEOUT_MS = 240_000;
const WEB_RESULTS = 6;

const response = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          annotations: z
            .array(
              z.object({
                type: z.string(),
                url_citation: z.object({ url: z.string(), title: z.string().optional() }).optional(),
              }),
            )
            .optional(),
        }),
      }),
    )
    .min(1),
  usage: z.object({ cost: z.number().optional() }).optional(),
});

async function call(opts: OrOptions, extra: Record<string, unknown>): Promise<OrResult<string>> {
  const { OPENROUTER_API_KEY, OPENROUTER_BASE_URL } = councilEnv();
  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env().NEXT_PUBLIC_SITE_URL,
      'X-Title': 'HeyToolie',
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      reasoning: { effort: opts.effort ?? 'medium' },
      usage: { include: true },
      ...(opts.web ? { plugins: [{ id: 'web', max_results: WEB_RESULTS }] } : {}),
      ...extra,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${opts.model} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const parsed = response.safeParse(await res.json());
  if (!parsed.success) throw new Error(`${opts.model} returned an unexpected response`);
  const message = parsed.data.choices[0].message;
  const citations = (message.annotations ?? []).flatMap((a) =>
    a.type === 'url_citation' && a.url_citation ? [{ url: a.url_citation.url, title: a.url_citation.title ?? '' }] : [],
  );
  return { data: message.content?.trim() ?? '', cost: parsed.data.usage?.cost ?? 0, citations: dedupeCitations(citations) };
}

/** Plain-text answer (research briefs). */
export async function orText(opts: OrOptions): Promise<OrResult<string>> {
  const out = await call(opts, {});
  if (!out.data) throw new Error(`${opts.model} returned no text`);
  return out;
}

/**
 * JSON answer validated against a Zod schema. Asks for structured output and
 * only routes to providers that support it; still parses leniently (code
 * fences, prose around the object) since not every model obeys perfectly.
 * Never throws a ZodError — route() would report that as the caller's bad request.
 */
export async function orJson<T>(schema: z.ZodType<T>, name: string, opts: OrOptions): Promise<OrResult<T>> {
  const out = await call(opts, {
    response_format: { type: 'json_schema', json_schema: { name, schema: z.toJSONSchema(schema) } },
    provider: { require_parameters: true },
  });
  const json = extractJson(out.data);
  if (json === undefined) throw new Error(`${opts.model} returned invalid JSON`);
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error(`${opts.model} output failed validation: ${parsed.error.message.slice(0, 500)}`);
  return { ...out, data: parsed.data };
}

/** The JSON object in a model reply, tolerating fences and stray prose. Pure. */
export function extractJson(text: string): unknown {
  const attempts = [text, text.replace(/^```(?:json)?\s*|\s*```$/g, '')];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) attempts.push(text.slice(start, end + 1));
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {}
  }
  return undefined;
}

/** First occurrence of each URL, keeping the earliest title. Pure. */
export function dedupeCitations(citations: Citation[]): Citation[] {
  const byUrl = new Map<string, Citation>();
  for (const c of citations) if (/^https?:\/\//.test(c.url) && !byUrl.has(c.url)) byUrl.set(c.url, c);
  return [...byUrl.values()];
}
