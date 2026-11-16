import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { removeFramework } from '@/lib/playbook/service';

/** Take a framework out of the playbook. */
export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  await removeFramework(user.id, (await params).id);
  return NextResponse.json({ ok: true });
});
