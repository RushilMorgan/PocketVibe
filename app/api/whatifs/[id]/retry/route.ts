import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { retryWhatIf } from '@/lib/whatif/service';

export const maxDuration = 120;

/** Try again on a what-if that failed or never finished. */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return NextResponse.json({ whatif: await retryWhatIf(user.id, z.uuid().parse(id)) });
});
