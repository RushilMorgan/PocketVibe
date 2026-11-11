import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { markTapped } from '@/lib/nudges/service';

const body = z.object({ action: z.enum(['open', 'read', 'play']).default('open') });

/** A notification was tapped: components/nudge-tap.tsx sends this from the ?n= in its URL. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { action } = body.parse(await req.json().catch(() => ({})));
  await markTapped(user.id, id, action);
  return NextResponse.json({ ok: true });
});
