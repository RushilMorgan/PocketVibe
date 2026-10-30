import { NextResponse } from 'next/server';
import { signOut } from '@/lib/auth';
import { route } from '@/lib/http';

export const POST = route(async () => {
  await signOut();
  return NextResponse.json({ ok: true });
});
