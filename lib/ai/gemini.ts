import 'server-only';
import {
  GoogleGenAI,
  MediaResolution,
  ThinkingLevel,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import { z } from 'zod';
import { env } from '@/lib/env';
import { currentUsage, recordUsage, type UsageScope } from './usage';
import type { Feature } from './usage-summary';

let client: GoogleGenAI | undefined;

function ai(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: env().GEMINI_API_KEY });
  return client;
}

/**
 * Two tiers (models set in lib/env.ts; benchmarked 2026-11-02 on real saves):
 * - fast: big inputs and plumbing — watching videos, recipes, classifying, picking.
 * - pro:  where intelligence shows — explainers, lessons, diagrams, chat.
 */
export type Model = 'fast' | 'pro';
export type Thinking = 'low' | 'medium' | 'high';

function modelId(model: Model): string {
  return model === 'pro' ? env().GEMINI_MODEL_PRO : env().GEMINI_MODEL_FAST;
}

const LEVEL: Record<Thinking, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * Thinking depth per call: fast models think lightly, pro models medium. Only
 * sent to models that take a thinking *level* (Gemini 3.5+ / 4); older ones
 * reject it, so swapping the env back to a 2.5 model still works.
 */
function thinkingConfig(id: string, model: Model, thinking?: Thinking): Pick<GenerateContentConfig, 'thinkingConfig'> {
  if (!/^gemini-(?:[4-9]|3\.[5-9])/.test(id)) return {};
  return { thinkingConfig: { thinkingLevel: LEVEL[thinking ?? (model === 'pro' ? 'medium' : 'low')] } };
}

/** A public YouTube video passed to Gemini by URL (no download needed). */
export function youtubePart(watchUrl: string): Part {
  return { fileData: { fileUri: watchUrl, mimeType: 'video/*' } };
}

interface GenerateOptions {
  /** What the call is for, for AI usage tracking (lib/ai/usage.ts). */
  feature: Feature;
  model?: Model;
  /** An exact model id overriding the tier's default (the user's Settings choice). */
  modelId?: string;
  thinking?: Thinking;
  /** Lower resolution ≈ 1/4 the video tokens; plenty for speech-heavy Shorts. */
  lowMediaResolution?: boolean;
}

/** Shared per-call config: thinking depth and video resolution. */
function baseConfig(opts: Omit<GenerateOptions, 'feature'>): { model: string; config: GenerateContentConfig } {
  const tier = opts.model ?? 'fast';
  const model = opts.modelId ?? modelId(tier);
  return {
    model,
    config: {
      ...thinkingConfig(model, tier, opts.thinking),
      ...(opts.lowMediaResolution ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
    },
  };
}

/** Logs a response's token counts (and any Google searches it ran) against the current user and save. */
async function logUsage(feature: Feature, model: string, res: Pick<GenerateContentResponse, 'usageMetadata' | 'candidates'>, at?: UsageScope) {
  const u = res.usageMetadata;
  await recordUsage(
    {
      feature,
      provider: 'gemini',
      model,
      // Search results the model read (tool-use tokens) are billed as input.
      inputTokens: (u?.promptTokenCount ?? 0) + (u?.toolUsePromptTokenCount ?? 0),
      cachedTokens: u?.cachedContentTokenCount ?? 0,
      outputTokens: u?.candidatesTokenCount ?? 0,
      thinkingTokens: u?.thoughtsTokenCount ?? 0,
      searchQueries: res.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length ?? 0,
    },
    at,
  );
}

export async function generateText(parts: Part[], opts: GenerateOptions): Promise<string> {
  const { model, config } = baseConfig(opts);
  const res = await ai().models.generateContent({ model, contents: [{ role: 'user', parts }], config });
  await logUsage(opts.feature, model, res);
  const text = res.text?.trim();
  if (!text) throw new Error('Gemini returned no text');
  return text;
}

export interface GroundingSource {
  /** Usually a Google redirect link; follow it to reach the real page. */
  uri: string;
  title: string;
}

/**
 * A call grounded in live Google Search results. Returns the model's text
 * plus the pages Search actually used — those links are real, unlike URLs the
 * model types into its answer. JSON mode can't be combined with tools, so
 * callers parse the text themselves.
 */
export async function generateGrounded(text: string, opts: GenerateOptions): Promise<{ text: string; sources: GroundingSource[] }> {
  const { model, config } = baseConfig(opts);
  const res = await ai().models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text }] }],
    config: { ...config, tools: [{ googleSearch: {} }] },
  });
  await logUsage(opts.feature, model, res);
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks.flatMap((c) => (c.web?.uri ? [{ uri: c.web.uri, title: c.web.title ?? '' }] : []));
  return { text: res.text?.trim() ?? '', sources };
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

/**
 * Streams a multi-turn answer as plain text chunks. Usage is logged when the
 * stream ends or is abandoned, against the scope at the time of the call (the
 * stream is read after the route has returned).
 */
export function streamText(system: string, turns: ChatTurn[], opts: GenerateOptions): AsyncGenerator<string> {
  const at = currentUsage();
  return (async function* () {
    const { model, config } = baseConfig(opts);
    const stream = await ai().models.generateContentStream({
      model,
      contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      config: { ...config, systemInstruction: system },
    });
    // The final chunk carries the totals.
    let last: GenerateContentResponse | undefined;
    try {
      for await (const chunk of stream) {
        if (chunk.usageMetadata) last = chunk;
        if (chunk.text) yield chunk.text;
      }
    } finally {
      if (last) await logUsage(opts.feature, model, last, at);
    }
  })();
}

/** Matches the vector(768) columns. */
const EMBED_DIMS = 768;
const EMBED_BATCH = 100;

export type EmbedTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY';

/** The embeddings API reports no token counts; Gemini text runs about 4 characters a token. */
const CHARS_PER_TOKEN = 4;

/** Embeds many texts (batched); returns pgvector literals in input order. */
export async function embed(texts: string[], taskType: EmbedTask, feature: Feature): Promise<string[]> {
  const out: string[] = [];
  const model = env().GEMINI_EMBED_MODEL;
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const res = await ai().models.embedContent({
      model,
      contents: batch,
      config: { taskType, outputDimensionality: EMBED_DIMS },
    });
    const chars = batch.reduce((sum, t) => sum + t.length, 0);
    await recordUsage({ feature, provider: 'gemini', model, inputTokens: Math.ceil(chars / CHARS_PER_TOKEN), outputTokens: 0 });
    for (const e of res.embeddings ?? []) {
      if (e.values?.length !== EMBED_DIMS) throw new Error('Unexpected embedding size');
      out.push(`[${e.values.join(',')}]`);
    }
  }
  if (out.length !== texts.length) throw new Error('Embedding count mismatch');
  return out;
}

/** JSON-mode call validated against a Zod schema; throws if the model strays. */
export async function generateJson<T>(schema: z.ZodType<T>, parts: Part[], opts: GenerateOptions): Promise<T> {
  const { model, config } = baseConfig(opts);
  const res = await ai().models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: { ...config, responseMimeType: 'application/json', responseJsonSchema: z.toJSONSchema(schema) },
  });
  // Before parsing: a reply that fails validation was still paid for.
  await logUsage(opts.feature, model, res);
  // Not a ZodError: route() would report that as the caller's bad request.
  let json: unknown;
  try {
    json = JSON.parse(res.text ?? '');
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error(`Gemini output failed validation: ${parsed.error.message}`);
  return parsed.data;
}
