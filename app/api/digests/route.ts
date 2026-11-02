import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { inngest } from '@/lib/jobs/client';
import { digestRequested } from '@/lib/jobs/weekly-digest';

/** "Send me this week's digest now" — same job as the Sunday cron, just for you. */
export const POST = route(async () => {
  const user = await requireUser();
  await inngest.send(digestRequested.create({ userId: user.id }));
  return NextResponse.json({ queued: true }, { status: 202 });
});
