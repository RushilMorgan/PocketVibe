import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { deleteRun, getRun } from '@/lib/playbook/service';

type Ctx = { params: Promise<{ id: string }> };

/** One idea worked through the playbook. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  return NextResponse.json({ run: await getRun(user.id, (await params).id) });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  await deleteRun(user.id, (await params).id);
  return NextResponse.json({ ok: true });
});
