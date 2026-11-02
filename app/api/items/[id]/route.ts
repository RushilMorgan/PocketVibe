import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { getThumbs } from '@/lib/items/actions';
import { getItem } from '@/lib/items/service';
import { unplayedLesson } from '@/lib/lessons/service';

/** The item, its outputs, your 👍/👎, and the lesson Play should open (so it skips a round trip). */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const [item, thumbs, playLessonId] = await Promise.all([
    getItem(user.id, id),
    getThumbs(user.id, id),
    unplayedLesson(user.id, id),
  ]);
  return NextResponse.json({ item, thumbs, playLessonId });
});
