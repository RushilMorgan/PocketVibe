import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { mergeTopic } from '@/lib/topics';

/** Fold this topic into another one (body: { into }). */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { into } = z.object({ into: z.uuid() }).parse(await req.json());
  await mergeTopic(user.id, z.uuid().parse(id), into);
  return NextResponse.json({ ok: true });
});
