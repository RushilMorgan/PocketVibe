import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { extractRecipeFromInput } from '@/lib/handlers/recipe';
import { HttpError, route } from '@/lib/http';
import { takePublicUse } from '@/lib/public-limit';

// Watching a video can take a minute or two.
export const maxDuration = 180;

const body = z.object({ url: z.string().max(2000).optional(), text: z.string().max(20_000).optional() });

/** Public recipe extractor (no login). Visitors get a small daily allowance. */
export const POST = route(async (req: Request) => {
  const input = body.parse(await req.json());
  const refund = (await getCurrentUser()) ? null : await takePublicUse(req, 'recipe');
  try {
    return NextResponse.json({ recipe: await extractRecipeFromInput(input) });
  } catch (err) {
    await refund?.();
    if (err instanceof HttpError) throw err;
    console.error('public recipe failed', err);
    throw new HttpError(502, "Couldn't pull a recipe out of that — try another link, or paste the recipe text.");
  }
});
