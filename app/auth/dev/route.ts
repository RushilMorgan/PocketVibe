import { NextResponse, type NextRequest } from 'next/server';
import { devSignIn, safeNext } from '@/lib/auth';
import { devLoginEmail } from '@/lib/dev-login';

/**
 * Local-only sign-in: http://localhost:3000/auth/dev?next=/ signs in as
 * DEV_LOGIN_EMAIL without an email. A 404 anywhere but `next dev` on localhost.
 */
export async function GET(req: NextRequest) {
  const email = devLoginEmail(process.env.NODE_ENV, req.nextUrl.hostname, process.env.DEV_LOGIN_EMAIL);
  if (!email) return new NextResponse('Not found', { status: 404 });
  try {
    await devSignIn(email);
  } catch (err) {
    console.error('dev sign-in failed', err);
    return new NextResponse(err instanceof Error ? err.message : 'Dev sign-in failed', { status: 400 });
  }
  return NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get('next')), req.url), 303);
}
