import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { makeDiagram } from '@/lib/items/actions';

// Up to two Gemini drafts plus a render.
export const maxDuration = 90;

/** The Diagram button: draws (or redraws) this item's diagram. */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return NextResponse.json({ diagram: await makeDiagram(user.id, id) });
});
