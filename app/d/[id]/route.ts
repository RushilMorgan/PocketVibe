import { NextResponse, type NextRequest } from 'next/server';
import { verifyLink } from '@/lib/digest/links';
import { recordDigestTap } from '@/lib/digest/service';

/**
 * Digest link tracker: verifies the signature, logs digest_open, redirects.
 * No session needed, so taps from an email client still count.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const to = req.nextUrl.searchParams.get('to') ?? '';
  const sig = req.nextUrl.searchParams.get('s') ?? '';
  const isPath = to.startsWith('/') && !to.startsWith('//');
  if (!verifyLink(id, to, sig) || !(isPath || /^https?:\/\//i.test(to))) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  try {
    await recordDigestTap(id, to);
  } catch (err) {
    console.error('digest tap not logged', err); // Never block the visitor on analytics.
  }
  return NextResponse.redirect(isPath ? new URL(to, req.url) : to);
}
