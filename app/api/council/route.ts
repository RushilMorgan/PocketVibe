import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { newSessionRequest } from '@/lib/council/schemas';
import { createSession, listSessions } from '@/lib/council/service';
import { route } from '@/lib/http';

/** Past council sessions, newest first. */
export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ sessions: await listSessions(user.id) });
});

/** Put an idea to the council; the job runs in the background. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { idea } = newSessionRequest.parse(await req.json());
  return NextResponse.json(await createSession(user.id, idea), { status: 201 });
});
