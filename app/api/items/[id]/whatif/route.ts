import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { addWhatIf } from '@/lib/whatif/service';

// A Search-grounded call, then the smart model writes the card.
export const maxDuration = 120;

const body = z.union([
  z.object({ origin: z.literal('auto') }),
  z.object({ origin: z.enum(['other', 'custom']), scenario: z.string().min(1).max(400) }),
]);

/** Write this save's what-if, or add another scenario (docs/what-if.md B4). */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return NextResponse.json({ whatIf: await addWhatIf(user.id, id, body.parse(await req.json())) });
});
