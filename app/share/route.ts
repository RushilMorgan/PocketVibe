import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import { saveItem } from '@/lib/items/service';
import { extractUrl } from '@/lib/items/source';
import { parkShare } from '@/lib/pending-share';

/**
 * Web Share Target. Android POSTs title/text/url as a form; GET is accepted
 * too for older installs and manual testing. Responds with a redirect to the
 * item page, which shows "Got it, working on it…" straight away.
 */
async function handle(req: NextRequest, fields: { url?: string | null; text?: string | null; title?: string | null }) {
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);
  const url = extractUrl(fields);
  if (!url) return to('/?share=nolink');

  const user = await getCurrentUser();
  if (!user) {
    await parkShare(url);
    return to('/login?share=1');
  }

  try {
    const item = await saveItem(user.id, url);
    return to(`/items/${item.id}`);
  } catch (err) {
    if (err instanceof HttpError && err.status === 429) return to('/?share=cap');
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : null;
  };
  return handle(req, { url: field('url'), text: field('text'), title: field('title') });
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return handle(req, { url: p.get('url'), text: p.get('text'), title: p.get('title') });
}
