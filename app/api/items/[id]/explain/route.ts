import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { reExplain } from '@/lib/items/actions';

export const maxDuration = 60;

const body = z.object({ mode: z.enum(['normal', 'simpler', 'deeper']) });

/** Explain simpler · Go deeper. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { mode } = body.parse(await req.json());
  return NextResponse.json({ explainer: await reExplain(user.id, id, mode) });
});
