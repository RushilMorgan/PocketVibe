import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { snoozeItem } from '@/lib/items/feed-service';

/** "Not now" on the feed's Up next card. */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return NextResponse.json({ snoozedUntil: await snoozeItem(user.id, id) });
});
