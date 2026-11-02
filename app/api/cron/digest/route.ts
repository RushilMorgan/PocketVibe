import { NextResponse } from 'next/server';
import { inngest } from '@/lib/jobs/client';
import { digestRequested } from '@/lib/jobs/weekly-digest';
import { adminClient } from '@/lib/supabase/server';

/**
 * Vercel Cron, Sundays 16:00 UTC = 18:00 SAST (vercel.json). Fans out one
 * Inngest job per user; the jobs do the slow work with retries.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: users, error } = await adminClient().from('users').select('id');
  if (error) throw error;
  if (users?.length) await inngest.send(users.map((u) => digestRequested.create({ userId: u.id })));
  return NextResponse.json({ queued: users?.length ?? 0 });
}
