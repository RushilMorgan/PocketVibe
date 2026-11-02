import 'server-only';
import { eventType } from 'inngest';
import { z } from 'zod';
import { newForYou, saveDigest, suggestedLesson, yourWeek } from '@/lib/digest/build';
import { deliverDigest } from '@/lib/digest/service';
import { inngest } from './client';

/** Build and send one user's weekly digest. Sent by the Sunday cron and "send me it now". */
export const digestRequested = eventType('digest/requested', {
  schema: z.object({ userId: z.uuid() }),
});

/**
 * Weekly digest: your week → new finds (Search-grounded, the slow part) →
 * suggested lesson → save → push + email. Each part retries on its own.
 */
export const weeklyDigest = inngest.createFunction(
  {
    id: 'weekly-digest',
    triggers: [digestRequested],
    retries: 2,
    concurrency: { key: 'event.data.userId', limit: 1 },
  },
  async ({ event, step }) => {
    const { userId } = event.data;
    const now = new Date(event.ts ?? Date.now());

    const week = await step.run('your-week', () => yourWeek(userId, now));
    const finds = await step.run('new-for-you', () => newForYou(userId));
    const lesson = await step.run('suggested-lesson', () => suggestedLesson(userId));
    const digestId = await step.run('save', () => saveDigest(userId, now, { ...week, finds, lesson }));
    const sent = await step.run('deliver', () => deliverDigest(userId, digestId));

    return { digestId, ...sent };
  },
);
