import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { setWantToCook } from '@/lib/recipes/service';

const body = z.object({ on: z.boolean() });

/** Put a recipe on the Want to cook list, or take it off. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { on } = body.parse(await req.json());
  return NextResponse.json({ wantToCookAt: await setWantToCook(user.id, id, on) });
});
