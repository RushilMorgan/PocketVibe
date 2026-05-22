import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[EverySite] ⚠️  Supabase env vars are missing.\n' +
      'Copy .env.example → .env.local and fill in your project URL and anon key.\n' +
      'Dashboard → Settings → API',
  );
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
);

/** True when both env vars are present and non-empty. */
export const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
