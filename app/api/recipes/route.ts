import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { listRecipes } from '@/lib/recipes/service';

/** Every recipe you've saved, for the Recipes page. */
export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ recipes: await listRecipes(user.id) });
});
