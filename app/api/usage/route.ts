import { NextResponse } from 'next/server';
import { usageReport } from '@/lib/ai/usage';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';

/** The Settings "AI usage" card: this month and last, by feature, the costliest saves. */
export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json(await usageReport(user.id, user.timezone));
});
