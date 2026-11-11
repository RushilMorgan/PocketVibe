import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { getReviewCard, recordReview } from '@/lib/reviews/service';

type Ctx = { params: Promise<{ itemId: string }> };

/** The review card for a save: recall, or Then and now when it connects to another. */
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { itemId } = await ctx.params;
  return NextResponse.json({ card: await getReviewCard(user.id, itemId) });
});

const body = z.object({ format: z.enum(['recall', 'connect']), rating: z.enum(['got', 'fuzzy', 'forgot']) });

/** Rate yourself on the card; returns when the next one is due. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { itemId } = await ctx.params;
  const { format, rating } = body.parse(await req.json());
  return NextResponse.json(await recordReview(user.id, itemId, format, rating));
});
