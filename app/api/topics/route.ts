import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { listTopics } from '@/lib/topics';

export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ topics: await listTopics(user.id) });
});
