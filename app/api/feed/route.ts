import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { getFeed } from '@/lib/items/feed-service';

const query = z.object({
  filter: z.enum(['unread', 'whatif', 'recipe']).optional(),
  topic: z.uuid().optional(),
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** The saves feed: items with their state, plus Up next, counts, streak and this week. */
export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const q = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  const feed = await getFeed(user.id, { filter: q.filter, topicId: q.topic, before: q.before, limit: q.limit });
  return NextResponse.json(feed);
});
