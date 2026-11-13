import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { getThumbs } from '@/lib/items/actions';
import { getItem } from '@/lib/items/service';
import { unplayedLesson } from '@/lib/lessons/service';
import { listWhatIfs } from '@/lib/whatif/service';

/** The item, its outputs and what-ifs, your 👍/👎, and the lesson Play should open (so it skips a round trip). */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const item = await getItem(user.id, id); // 404s first for a bad id
  const [thumbs, playLessonId, whatifs] = await Promise.all([
    getThumbs(user.id, id),
    unplayedLesson(user.id, id),
    listWhatIfs(user.id, id),
  ]);
  return NextResponse.json({ item, thumbs, playLessonId, whatifs });
});
