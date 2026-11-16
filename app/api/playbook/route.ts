import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { listFrameworks, listRuns } from '@/lib/playbook/service';

/** The Playbook page: every framework you've kept and the ideas you've worked through them. */
export const GET = route(async () => {
  const user = await requireUser();
  const [frameworks, runs] = await Promise.all([listFrameworks(user.id), listRuns(user.id)]);
  return NextResponse.json({ frameworks, runs });
});
