import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { createLesson, unplayedLesson } from '@/lib/lessons/service';

// Gemini Pro, plus one regenerate if the JSON is invalid.
export const maxDuration = 120;

const body = z.object({
  itemId: z.uuid(),
  /** "Another on this topic": always write a new one. */
  fresh: z.boolean().optional(),
});

/** Play: reuse an unplayed lesson for the item, else write one. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { itemId, fresh } = body.parse(await req.json());
  const existing = fresh ? null : await unplayedLesson(user.id, itemId);
  return NextResponse.json({ lessonId: existing ?? (await createLesson(user.id, itemId)) });
});
