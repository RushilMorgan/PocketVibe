import 'server-only';
import { cache } from 'react';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/http';
import { adminClient, createSessionClient } from '@/lib/supabase/server';
import type { UserRow } from '@/lib/supabase/database.types';

/**
 * Sign-up is locked to allowed_emails. The before-user-created auth hook stops
 * new accounts; these checks also keep out accounts that predate the reboot.
 */
async function isAllowed(email: string): Promise<boolean> {
  const { data, error } = await adminClient()
    .from('allowed_emails')
    .select('email')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/** Sends a magic link that lands on /auth/callback, then `next`. */
export async function sendMagicLink(rawEmail: string, next: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!(await isAllowed(email))) {
    throw new HttpError(403, 'HeyToolie is invite-only for now.');
  }
  const supabase = await createSessionClient();
  const redirect = new URL('/auth/callback', env().NEXT_PUBLIC_SITE_URL);
  redirect.searchParams.set('next', safeNext(next));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirect.toString() },
  });
  if (error) throw new HttpError(400, error.message);
}

/** Exchanges the magic-link code for a session cookie. */
export async function completeSignIn(code: string): Promise<void> {
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw new HttpError(400, error.message);
}

export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
}

/**
 * The signed-in, allowlisted user (creating their users row on first sight),
 * or null. Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<UserRow | null> => {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser?.email || !(await isAllowed(authUser.email))) return null;

  const db = adminClient();
  const { data: existing, error } = await db.from('users').select('*').eq('id', authUser.id).maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await db
    .from('users')
    .upsert({ id: authUser.id, email: authUser.email.toLowerCase() })
    .select('*')
    .single();
  if (insertError) throw insertError;
  return created;
});

export async function requireUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Please sign in.');
  return user;
}

/** Only allow same-site relative redirects (no `//evil.com`). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
