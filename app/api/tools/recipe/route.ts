import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { extractRecipeFromInput } from '@/lib/handlers/recipe';
import { HttpError, route } from '@/lib/http';

// Watching a video can take a minute or two.
export const maxDuration = 180;

const body = z.object({ url: z.string().max(2000).optional(), text: z.string().max(20_000).optional() });

/** Standalone recipe extractor (signed-in, allowlisted users only). */
export const POST = route(async (req: Request) => {
  await requireUser();
  const input = body.parse(await req.json());
  try {
    return NextResponse.json({ recipe: await extractRecipeFromInput(input) });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error('recipe tool failed', err);
    throw new HttpError(502, "Couldn't pull a recipe out of that — try another link, or paste the recipe text.");
  }
});
