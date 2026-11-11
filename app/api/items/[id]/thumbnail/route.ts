import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { refreshThumbnail } from '@/lib/items/feed-service';

/** Called once by a feed card whose image failed to load. */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return NextResponse.json({ thumbnailUrl: await refreshThumbnail(user.id, id) });
});
