import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { forgetTopic, renameTopic } from '@/lib/topics';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { name } = z.object({ name: z.string().min(1).max(40) }).parse(await req.json());
  await renameTopic(user.id, z.uuid().parse(id), name);
  return NextResponse.json({ ok: true });
});

/** Forget a topic. */
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await forgetTopic(user.id, z.uuid().parse(id));
  return NextResponse.json({ ok: true });
});
