/**
 * Centralised Supabase client.
 * Returns null when the environment variables are not configured (tests, local dev without backend).
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase client singleton. null when env vars are absent. */
export const supabase = url && key ? createClient(url, key) : null;

export function isAuthAvailable(): boolean {
  return Boolean(supabase);
}
