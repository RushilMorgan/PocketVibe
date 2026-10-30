import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { setThumbs } from '@/lib/items/actions';

const body = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { value } = body.parse(await req.json());
  await setThumbs(user.id, id, value);
  return NextResponse.json({ thumbs: value });
});
