import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { settingsUpdate, updateSettings } from '@/lib/users';

export const GET = route(async () => NextResponse.json({ user: await requireUser() }));

/** Explanation level, tone, display name. */
export const PATCH = route(async (req: Request) => {
  const user = await requireUser();
  return NextResponse.json({ user: await updateSettings(user.id, settingsUpdate.parse(await req.json())) });
});
