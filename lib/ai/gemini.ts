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
  return schema.parse(JSON.parse(res.text ?? ''));
}
