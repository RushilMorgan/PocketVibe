import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { listItems, saveItem } from '@/lib/items/service';

export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const p = req.nextUrl.searchParams;
  const items = await listItems(user.id, {
    topicId: p.get('topic') ?? undefined,
    before: p.get('before') ?? undefined,
    limit: p.has('limit') ? Number(p.get('limit')) : undefined,
  });
  return NextResponse.json({ items });
});

const createBody = z.object({ url: z.string().min(1) });

/** Paste-box fallback for apps with no share button. */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { url } = createBody.parse(await req.json());
  const item = await saveItem(user.id, url);
  return NextResponse.json({ item }, { status: 201 });
});
