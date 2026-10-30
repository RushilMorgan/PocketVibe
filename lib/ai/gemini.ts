import 'server-only';
import { GoogleGenAI, MediaResolution, type Part } from '@google/genai';
import { z } from 'zod';
import { env } from '@/lib/env';

let client: GoogleGenAI | undefined;

function ai(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: env().GEMINI_API_KEY });
  return client;
}

export type Model = 'fast' | 'pro';

function modelId(model: Model): string {
  return model === 'pro' ? env().GEMINI_MODEL_PRO : env().GEMINI_MODEL_FAST;
}

/** A public YouTube video passed to Gemini by URL (no download needed). */
export function youtubePart(watchUrl: string): Part {
  return { fileData: { fileUri: watchUrl, mimeType: 'video/*' } };
}

interface GenerateOptions {
  model?: Model;
  /** Lower resolution ≈ 1/4 the video tokens; plenty for speech-heavy Shorts. */
  lowMediaResolution?: boolean;
}

export async function generateText(parts: Part[], opts: GenerateOptions = {}): Promise<string> {
  const res = await ai().models.generateContent({
    model: modelId(opts.model ?? 'fast'),
    contents: [{ role: 'user', parts }],
    config: opts.lowMediaResolution ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : undefined,
  });
  const text = res.text?.trim();
  if (!text) throw new Error('Gemini returned no text');
  return text;
}

/** Matches the vector(768) columns. */
const EMBED_DIMS = 768;
const EMBED_BATCH = 100;

export type EmbedTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY';

/** Embeds many texts (batched); returns pgvector literals in input order. */
export async function embed(texts: string[], taskType: EmbedTask): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const res = await ai().models.embedContent({
      model: env().GEMINI_EMBED_MODEL,
      contents: texts.slice(i, i + EMBED_BATCH),
      config: { taskType, outputDimensionality: EMBED_DIMS },
    });
    for (const e of res.embeddings ?? []) {
      if (e.values?.length !== EMBED_DIMS) throw new Error('Unexpected embedding size');
      out.push(`[${e.values.join(',')}]`);
    }
  }
  if (out.length !== texts.length) throw new Error('Embedding count mismatch');
  return out;
}

/** JSON-mode call validated against a Zod schema; throws if the model strays. */
export async function generateJson<T>(schema: z.ZodType<T>, parts: Part[], opts: GenerateOptions = {}): Promise<T> {
  const res = await ai().models.generateContent({
    model: modelId(opts.model ?? 'fast'),
    contents: [{ role: 'user', parts }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: z.toJSONSchema(schema),
      ...(opts.lowMediaResolution ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
    },
  });
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
