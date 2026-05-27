import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

// ── Public types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string | undefined;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  isAvailable: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Resolve initial session
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? toAuthUser(data.session.user) : null);
      setLoading(false);
    });

    // Keep in sync with auth state changes (sign in/out, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string) {
    if (!supabase) return { error: 'Auth not available' };
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }

  async function signIn(email: string, password: string) {
    if (!supabase) return { error: 'Auth not available' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase?.auth.signOut();
  }

  return { user, loading, isAvailable: Boolean(supabase), signUp, signIn, signOut };
}
