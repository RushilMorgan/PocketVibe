import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { setUsageUser } from '@/lib/ai/usage';
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

/** Turns a magic link (PKCE code, or token_hash) into a session cookie. */
export async function completeSignIn(link: { code: string } | { tokenHash: string; type: string }): Promise<void> {
  const supabase = await createSessionClient();
  const { error } =
    'code' in link
      ? await supabase.auth.exchangeCodeForSession(link.code)
      : await supabase.auth.verifyOtp({
          token_hash: link.tokenHash,
          type: link.type === 'magiclink' ? 'magiclink' : 'email',
        });
  if (error) throw new HttpError(400, error.message);
}

/**
 * Local dev only (`/auth/dev`, guarded by lib/dev-login.ts): mints a magic
 * link with the service role and redeems it at once, so no email is sent.
 * Still refuses emails that aren't allowlisted.
 */
export async function devSignIn(email: string): Promise<void> {
  if (!(await isAllowed(email))) throw new HttpError(403, 'DEV_LOGIN_EMAIL is not in allowed_emails.');
  const { data, error } = await adminClient().auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new HttpError(400, error.message);
  await completeSignIn({ tokenHash: data.properties.hashed_token, type: 'magiclink' });
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
  // getClaims verifies the session JWT (locally with asymmetric signing keys,
  // else via Auth) — one less round trip than getUser on every request.
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  const email = typeof data?.claims.email === 'string' ? data.claims.email.toLowerCase() : null;
  if (!id || !email) return null;

  const db = adminClient();
  const [allowed, { data: existing, error }] = await Promise.all([
    isAllowed(email),
    db.from('users').select('*').eq('id', id).maybeSingle(),
  ]);
  if (error) throw error;
  if (!allowed) return null;
  if (existing) return existing;

  const { data: created, error: insertError } = await db.from('users').upsert({ id, email }).select('*').single();
  if (insertError) throw insertError;
  return created;
});

export async function requireUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Please sign in.');
  setUsageUser(user.id);
  return user;
}

/** Only allow same-site relative redirects (no `//evil.com`). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** For pages: the current user, or a redirect to sign in that returns to `path`. */
export async function pageUser(path: string): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) redirect(path === '/' ? '/login' : `/login?next=${encodeURIComponent(path)}`);
  return user;
}
