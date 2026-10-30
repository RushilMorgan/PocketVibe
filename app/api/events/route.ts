import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { logEvent } from '@/lib/events';
import { route } from '@/lib/http';

// Only the passive signals; saves, thumbs and plays are logged by their own actions.
const body = z.object({ type: z.enum(['opened', 'digest_open']), itemId: z.uuid().optional() });

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { type, itemId } = body.parse(await req.json());
  await logEvent(user.id, type, { itemId });
  return NextResponse.json({ ok: true });
});
