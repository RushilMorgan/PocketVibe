import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { runRequest } from '@/lib/playbook/schema';
import { runPlaybook } from '@/lib/playbook/service';

// A quick pick, then the smart model works the idea through up to three frameworks.
export const maxDuration = 120;

/** Work an idea through the playbook (docs/playbook.md). */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = runRequest.parse(await req.json());
  return NextResponse.json({ run: await runPlaybook(user.id, body.idea, body.frameworkIds) }, { status: 201 });
});
