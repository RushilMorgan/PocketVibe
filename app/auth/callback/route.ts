import { NextResponse, type NextRequest } from 'next/server';
import { completeSignIn, getCurrentUser, safeNext } from '@/lib/auth';
import { saveItem } from '@/lib/items/service';
import { takeParkedShare } from '@/lib/pending-share';

/** Magic-link landing: start the session, then save any link parked while signed out. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);

  if (!code) return to('/login?error=link');
  try {
    await completeSignIn(code);
  } catch {
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
