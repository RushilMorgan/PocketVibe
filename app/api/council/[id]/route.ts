import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { deleteSession, getSession } from '@/lib/council/service';
import { route } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

/** One session: its report (once ratified), every turn, and who sat on the council. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  return NextResponse.json({ session: await getSession(user.id, (await params).id) });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  await deleteSession(user.id, (await params).id);
  return NextResponse.json({ ok: true });
});
