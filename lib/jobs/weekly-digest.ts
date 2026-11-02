import 'server-only';
import { eventType } from 'inngest';
import { z } from 'zod';
import { findsForTopic, findsPlan, saveDigest, suggestedLesson, yourWeek } from '@/lib/digest/build';
import type { DigestContent } from '@/lib/digest/schema';
import { deliverDigest } from '@/lib/digest/service';
import { inngest } from './client';

/** Build and send one user's weekly digest. Sent by the Sunday cron and "send me it now". */
export const digestRequested = eventType('digest/requested', {
  schema: z.object({ userId: z.uuid() }),
});

/**
 * Weekly digest: your week → new finds (Search-grounded, one step per topic) →
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

    // One step per topic: each is a slow search + page checks, and later
    // topics are told what earlier ones picked so the finds vary.
    const plan = await step.run('finds-plan', () => findsPlan(userId));
    const finds: DigestContent['finds'] = [];
    for (const [i, topic] of plan.topics.entries()) {
      const items = await step.run(`finds-${i + 1}`, () => findsForTopic(userId, topic, plan.saved, finds));
      if (items.length) finds.push({ topic, items });
    }

    const lesson = await step.run('suggested-lesson', () => suggestedLesson(userId));
    const digestId = await step.run('save', () => saveDigest(userId, now, { ...week, finds, lesson }));
    const sent = await step.run('deliver', () => deliverDigest(userId, digestId));

    return { digestId, ...sent };
  },
);
