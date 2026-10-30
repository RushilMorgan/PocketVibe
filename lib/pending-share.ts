import 'server-only';
import { cookies } from 'next/headers';

/**
 * A link shared while signed out is parked in a cookie, then saved as soon as
 * the magic-link sign-in completes — so the share is never lost.
 */
const COOKIE = 'pending_share';

export async function parkShare(url: string): Promise<void> {
  (await cookies()).set(COOKIE, url, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 3600 });
}

export async function takeParkedShare(): Promise<string | null> {
  const store = await cookies();
  const url = store.get(COOKIE)?.value ?? null;
  if (url) store.delete(COOKIE);
  return url;
}
