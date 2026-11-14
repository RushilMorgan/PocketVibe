import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { cookRequest, logCook } from '@/lib/recipes/service';

/** "I cooked this", with an optional rating and a note for next time. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return NextResponse.json({ cook: await logCook(user.id, id, cookRequest.parse(await req.json())) }, { status: 201 });
});
