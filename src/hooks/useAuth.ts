import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { SiteConfig } from '../types';

export interface SiteRow {
  id: string;
  email: string;
  subdomain: string;
  config: SiteConfig;
}

export interface AuthState {
  loading: boolean;
  session: Session | null;
  siteRow: SiteRow | null;
}

async function loadSiteRow(email: string): Promise<SiteRow | null> {
  const { data, error } = await supabase
    .from('sites')
    .select('id, email, subdomain, config')
    .eq('email', email)
    .single();
  if (error || !data) return null;
  return data as SiteRow;
}

export function useAuth(): AuthState {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [siteRow, setSiteRow] = useState<SiteRow | null>(null);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(s);
      if (s?.user?.email) {
        const row = await loadSiteRow(s.user.email);
        if (alive) setSiteRow(row);
      }
      if (alive) setLoading(false);
    }

    boot();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!alive) return;
      setSession(s);
      if (s?.user?.email) {
        const row = await loadSiteRow(s.user.email);
        if (alive) setSiteRow(row);
      } else {
        if (alive) setSiteRow(null);
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  return { loading, session, siteRow };
}
