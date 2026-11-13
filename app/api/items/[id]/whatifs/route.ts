import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { SCENARIO_MAX } from '@/lib/whatif/schema';
import { askWhatIf } from '@/lib/whatif/service';

// A Search call plus the smart model, and one retry if its JSON doesn't fit.
export const maxDuration = 120;

const body = z.object({ scenario: z.string().trim().min(3).max(SCENARIO_MAX) });

/** Another what-if on this save — a suggested one or your own — written now. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { scenario } = body.parse(await req.json());
  return NextResponse.json({ whatif: await askWhatIf(user.id, z.uuid().parse(id), scenario) }, { status: 201 });
});
