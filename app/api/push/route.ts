import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { pushSubscription, registerDevice, removeDevice } from '@/lib/push-devices';

/** Register this device for "your explainer is ready" pushes. */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  await registerDevice(user.id, pushSubscription.parse(await req.json()), req.headers.get('user-agent'));
  return NextResponse.json({ ok: true });
});

export const DELETE = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { endpoint } = z.object({ endpoint: z.url() }).parse(await req.json());
  await removeDevice(user.id, endpoint);
  return NextResponse.json({ ok: true });
});
