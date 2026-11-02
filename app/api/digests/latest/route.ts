import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { latestDigestId } from '@/lib/digest/service';
import { route } from '@/lib/http';

export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ id: await latestDigestId(user.id) });
});
