import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { followupRequest } from '@/lib/council/schemas';
import { askFollowup } from '@/lib/council/service';
import { route } from '@/lib/http';

/** Ask the council a follow-up on its report; answered in the background. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { question } = followupRequest.parse(await req.json());
  await askFollowup(user.id, (await params).id, question);
  return NextResponse.json({ ok: true }, { status: 202 });
});
