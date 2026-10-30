import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendMagicLink } from '@/lib/auth';
import { route } from '@/lib/http';

const body = z.object({ email: z.email(), next: z.string().optional() });

export const POST = route(async (req: Request) => {
  const { email, next } = body.parse(await req.json());
  await sendMagicLink(email, next ?? '/');
  return NextResponse.json({ ok: true });
});
