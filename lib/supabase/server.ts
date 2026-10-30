import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Session-aware client for route handlers and server components. Reads and
 * refreshes the auth cookies; queries run as the signed-in user under RLS.
 * Create one per request.
 */
export async function createSessionClient() {
  const store = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();
  return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        // Server components can't write cookies; the proxy refreshes the
        // session on the next request, so a failed write here is harmless.
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {}
      },
    },
  });
}

let admin: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Service-role client for background jobs and server-only writes. Bypasses
 * RLS, so every query must filter by user_id explicitly.
 */
export function adminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  admin ??= createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
