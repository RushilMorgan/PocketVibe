import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { retrySession } from '@/lib/council/service';
import { route } from '@/lib/http';

/** Re-run a failed session; finished stages are reused. */
export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  await retrySession(user.id, (await params).id);
  return NextResponse.json({ ok: true }, { status: 202 });
});
