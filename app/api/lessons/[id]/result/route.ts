import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { recordResult } from '@/lib/lessons/service';

/** End of a lesson: logs played + score (score event value is the fraction right). */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { score } = z.object({ score: z.number().int().min(0) }).parse(await req.json());
  await recordResult(user.id, id, score);
  return NextResponse.json({ ok: true });
});
