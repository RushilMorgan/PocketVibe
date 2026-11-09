import 'server-only';
import { z } from 'zod';

/**
 * Server-side environment, validated on first use (not at import) so `next
 * build` works without secrets present. See .env.example for what each does.
 */
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DAILY_ITEM_CAP: z.coerce.number().int().positive().default(50),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL_FAST: z.string().default('gemini-3.8-flash'),
  GEMINI_MODEL_PRO: z.string().default('gemini-4-argon'),
  GEMINI_EMBED_MODEL: z.string().default('gemini-embedding-001'),
});

/** The Council's multi-vendor gateway. Checked only when a council job runs. */
const councilSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  /** Any OpenAI-compatible gateway (OpenRouter, MegaLLM…). */
  OPENROUTER_BASE_URL: z.url().default('https://openrouter.ai/api/v1'),
  /** JSON {seat: model id} overriding lib/council/roster.ts, e.g. {"chair":"anthropic/claude-sonnet-5.5"}. */
  COUNCIL_MODELS: z.string().optional(),
  COUNCIL_DAILY_CAP: z.coerce.number().int().positive().default(5),
});

export type CouncilEnv = z.infer<typeof councilSchema>;

let councilCached: CouncilEnv | undefined;

export function councilEnv(): CouncilEnv {
  councilCached ??= councilSchema.parse(process.env);
  return councilCached;
}

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}

/** Web Push config, or null when it isn't set up (push is then skipped). */
export function pushEnv(): { publicKey: string; privateKey: string; subject: string } | null {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = process.env;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}
