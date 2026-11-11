import 'server-only';
import { sendReminder, usersDueAt } from '@/lib/nudges/send';
import { inngest } from './client';

/**
 * Reminders (docs/saves-redesign.md B0): every half hour from 07:00 to 21:30
 * South African time, send each user whose chosen slot this is at most one
 * reminder (a waiting lesson, the Wednesday check-in, or a streak about to
 * break). One step per user so one failure doesn't stop the rest.
 */
export const reminders = inngest.createFunction(
  {
    id: 'reminders',
    triggers: [{ cron: 'TZ=Africa/Johannesburg 0,30 7-21 * * *' }],
    retries: 1,
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    // Fixed once, so every retried step sees the same slot.
    const at = await step.run('slot', () => new Date().toISOString());
    const users = await step.run('due', () => usersDueAt(new Date(at)));
    const results: Record<string, string> = {};
    for (const userId of users) {
      const r = await step.run(`remind-${userId}`, async () => {
        try {
          return await sendReminder(userId, new Date(at));
        } catch (err) {
          console.error('reminder failed', userId, err);
          return { sent: false as const };
        }
      });
      results[userId] = r.sent ? (r.kind ?? 'sent') : 'none';
    }
    return results;
  },
);
