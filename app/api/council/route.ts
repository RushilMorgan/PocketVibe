import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { newSessionRequest } from '@/lib/council/schemas';
import { createSession, listSessions, referSave } from '@/lib/council/service';
import { route } from '@/lib/http';

/** Past council sessions, newest first. With ?itemId=, only the ones about that save. */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const itemId = new URL(req.url).searchParams.get('itemId') ?? undefined;
  return NextResponse.json({ sessions: await listSessions(user.id, itemId) });
});

/** Run something by the council: anything typed, or one of your saves. The job runs in the background. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = newSessionRequest.parse(await req.json());
  const session = 'itemId' in body ? await referSave(user.id, body.itemId, body.question) : await createSession(user.id, body.idea);
  return NextResponse.json(session, { status: 201 });
});
