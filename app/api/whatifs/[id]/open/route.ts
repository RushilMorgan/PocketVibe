import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { markWhatIfOpened } from '@/lib/whatif/service';

/** The full card was opened (only the first time is kept). */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await markWhatIfOpened(user.id, z.uuid().parse(id));
  return NextResponse.json({ ok: true });
});
