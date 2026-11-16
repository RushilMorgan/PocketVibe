import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { itemFrameworks, pullFrameworks } from '@/lib/playbook/service';

// The smart model reads the whole save.
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** The frameworks this save put in the playbook. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  return NextResponse.json({ frameworks: await itemFrameworks(user.id, (await params).id) });
});

/** Pull frameworks out of a save that has none. An empty list means it teaches nothing reusable. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  return NextResponse.json({ frameworks: await pullFrameworks(user.id, (await params).id) });
});
