import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { listTopics, topicsPage } from '@/lib/topics';

/** ?view=page: the Topics page (saves, trends, themes, mix). Otherwise the plain list the feed's chips use. */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  if (new URL(req.url).searchParams.get('view') === 'page') return NextResponse.json(await topicsPage(user.id));
  return NextResponse.json({ topics: await listTopics(user.id) });
});
