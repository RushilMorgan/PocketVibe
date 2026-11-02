import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDigest } from '@/lib/digest/service';
import { route } from '@/lib/http';

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return NextResponse.json({ digest: await getDigest(user.id, id) });
});
