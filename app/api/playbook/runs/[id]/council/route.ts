import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { debateRun } from '@/lib/playbook/service';

/** Take a finished run to the Council. Returns the new session's id. */
export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  return NextResponse.json(await debateRun(user.id, (await params).id), { status: 201 });
});
