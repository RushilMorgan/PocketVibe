import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { getStats } from '@/lib/stats-service';

/** How the app is being used: saves, opens, what-ifs, recipes, week by week. */
export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ stats: await getStats(user.id) });
});
