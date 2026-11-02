import { NextResponse, type NextRequest } from 'next/server';
import { completeSignIn, getCurrentUser, safeNext } from '@/lib/auth';
import { saveItem } from '@/lib/items/service';
import { takeParkedShare } from '@/lib/pending-share';

/**
 * Magic-link landing: start the session, then save any link parked while
 * signed out. Accepts the PKCE `code` form and the `token_hash` form (which
 * also works when the email is opened on a different device).
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const code = p.get('code');
  const tokenHash = p.get('token_hash');
  const next = safeNext(p.get('next'));
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);

  if (!code && !tokenHash) return to('/login?error=link');
  try {
    await completeSignIn(code ? { code } : { tokenHash: tokenHash!, type: p.get('type') ?? 'email' });
  } catch (err) {
    console.error('sign-in link rejected', err);
    return to('/login?error=link');
  }

  const user = await getCurrentUser();
  if (!user) return to('/login?error=invite');

  const parked = await takeParkedShare();
  if (parked) {
    try {
      const item = await saveItem(user.id, parked);
      return to(`/items/${item.id}`);
    } catch (err) {
      console.error('saving parked share failed', err);
    }
  }
  return to(next);
}
